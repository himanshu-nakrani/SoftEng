import {
  advancePackets,
  approach,
  bounceDrop,
  clamp01,
  drainQueue,
  emaEvent,
  recordSample,
  shouldSpawn,
  spawnPacket,
} from "@/engine/sim-helpers";
import type { LessonSim } from "@/engine/types";

/**
 * Lesson 5 — Cache Stampede. The sequel to Caching, with the keyspace
 * collapsed down to the thing that actually hurts: ONE hot key on a TTL.
 *
 * While it is fresh, every read for it is a hit and pg-main never hears about
 * it. The instant it expires, whatever arrives next has to go get the truth —
 * and with nothing coordinating them, *every* concurrent reader goes, each
 * opening its own read against a database sized for the miss rate, not for the
 * whole herd. That is the dogpile. Two switches fix two different halves of it:
 *
 *   COALESCING (single-flight)  — one fetch per expiry; the rest park at the
 *                                 cache (the count chip) and are served by that
 *                                 one fetch's return. Fixes DATABASE LOAD.
 *   STALE-WHILE-REVALIDATE      — the expired copy keeps being served while a
 *                                 refresh runs behind it. Fixes LATENCY.
 *
 * They are deliberately independent, because they really are: SWR with no
 * single-flight still fires a refresh per reader (the users just don't feel
 * it), and coalescing with no SWR still makes everyone wait — for one fetch.
 */

/** How a fetch in flight to pg-main is owed back when it returns. */
type FetchMode =
  /** Carries exactly one waiting reader (no coalescing). */
  | "single"
  /** Carries everyone parked at the cache (single-flight). */
  | "coalesced"
  /** Carries nobody — the readers already got the stale copy (SWR). */
  | "refresh";

/** A read parked in pg-main's queue, stamped so its wait is measurable. */
interface PendingRead {
  hot: boolean;
  mode: FetchMode;
  enqueuedAt: number;
}

interface StampedeState {
  /** Sim-seconds when the hot key was last filled; -1 = never populated. */
  filledAt: number;
  /** EXPIRE button / scripted beat: gone regardless of its age. */
  forced: boolean;
  /** Latches "the key is currently expired", so each expiry is one episode. */
  episode: boolean;
  /** Single-flight lock: a fetch for the hot key is already out. */
  fetching: boolean;
  fetchStartedAt: number;
  /**
   * Readers parked at the cache waiting on the coalesced fetch — their arrival
   * times, so each one's wait is real. This is an AGGREGATE by construction:
   * waiters are drawn as the count chip on redis-1, never as packets. Forty
   * waiting readers must not cost forty dots (the pool is 128 for everything).
   */
  waiters: number[];
  /** Fetches pg-main took for the hot key since it last expired. The star. */
  fetchesThisEpisode: number;
  /** Deepest the waiter pile got this episode — proof for the gated caption. */
  peakWaiters: number;
  /** Reads waiting at pg-main; doubles as its queue depth. */
  pending: PendingRead[];
  dbAcc: number;
  hitEma: number; // 0..1
  latencyEma: number; // ms
  staleServed: number;
  /** Reads pg-main refused outright (it was full and refusing connections). */
  errors: number;
  /** Scripted surge: a traffic floor in force until this sim-second. */
  surgeUntil: number;
}

/** Share of reads that are for the hot key. The rest keep the stage alive. */
const HOT_SHARE = 0.7;
/**
 * The other keys are not the lesson, so they are modelled as one warm set with
 * a fixed hit ratio rather than a real keyspace: 3 in 4 hit, the rest go to the
 * database. Their point is to be *collateral* — they share pg-main's queue, so
 * a dogpile on the hot key is what takes them down.
 */
const BG_HIT = 0.75;

/**
 * pg-main serves 5 reads/s. That is not a small number by accident: it is
 * sized for the *miss* rate a working cache leaves behind, which is the whole
 * reason one expiry can bury it.
 */
const DB_CAPACITY = 5;
/**
 * Overload, modelled the way a database actually fails — in two stages, not
 * one cliff.
 *
 * Past DEGRADE_DEPTH concurrent reads it thrashes and gets *slower*: more
 * queries in flight, less throughput each. Past COLLAPSE_DEPTH it is out of
 * connections and refuses new reads at the door, until the backlog is back
 * under RECOVER_DEPTH. Refusing is not the same as dying — the queries it
 * already accepted still finish, which is the only reason it climbs back out.
 * Throughput depends on the depth (contention), admission on the health; they
 * are deliberately separate.
 */
const DEGRADE_DEPTH = 12;
const COLLAPSE_DEPTH = 24;
const RECOVER_DEPTH = 6;
const DEGRADED_FACTOR = 0.65;

const HIT_MS = 60;
const MISS_MS = 60 + 340;

/**
 * Per-event EMA rates — both MUST stay below 1 (`emaEvent` pins dt to 1 and
 * `approach` clamps the blend factor there, so rate >= 1 latches onto the
 * newest sample and the hit gauge would only ever read 0% or 100%).
 */
const HIT_EMA_RATE = 0.12;
const LAT_EMA_RATE = 0.3;

/**
 * Waiter pile that reads as a fully-loaded cache — the load bar under redis-1
 * is "how many readers am I holding", not "how full am I".
 */
const WAITERS_FULL = 24;
/**
 * Response dots drawn when a coalesced fetch releases the pile. The release is
 * instantaneous and *all* waiters are served (and their latency booked); this
 * only bounds how much of it is drawn, because a 40-dot burst would eat a
 * third of the packet pool for one frame. The chip dropping to zero is the
 * honest visual of the dam breaking.
 */
const RELEASE_BURST = 20;
/**
 * Safety valve on the single-flight lock: a fetch that never comes home must
 * not park readers forever. Real single-flight implementations carry the same
 * timeout for the same reason.
 */
const LOCK_TIMEOUT = 6;

/**
 * The scripted beat: traffic ramps to peak first (the front edge takes half a
 * second to fill, so the surge has to be *arriving* before the key dies),
 * then the hot key is pulled out from under it.
 */
const SURGE_AT = 16.5;
const EXPIRE_AT = 18;
const SURGE_RATE = 30;
const SURGE_UNTIL = 26.5;

export const cacheStampedeSim: LessonSim<StampedeState> = {
  id: "cache-stampede",

  topology: {
    nodes: [
      { id: "client", kind: "client", label: "clients", x: 130, y: 225 },
      { id: "cache", kind: "cache", label: "redis-1", x: 400, y: 225 },
      { id: "db", kind: "database", label: "pg-main", x: 660, y: 225 },
    ],
    edges: [
      { id: "front", from: "client", to: "cache" },
      { id: "back", from: "cache", to: "db" },
    ],
  },

  params: [
    {
      key: "ttl",
      label: "hot key ttl",
      kind: "slider",
      min: 2,
      max: 20,
      step: 2,
      unit: "s",
      defaultValue: 8,
    },
    {
      key: "traffic",
      label: "traffic",
      kind: "slider",
      min: 4,
      max: 30,
      step: 2,
      unit: " req/s",
      defaultValue: 10,
    },
    {
      key: "coalesce",
      label: "coalescing",
      kind: "toggle",
      defaultValue: false,
    },
    {
      key: "swr",
      label: "stale-while-revalidate",
      kind: "toggle",
      defaultValue: false,
    },
    {
      key: "expire",
      label: "expire hot key",
      kind: "button",
      defaultValue: false,
    },
  ],

  /** The key starts warm — the lesson is about losing it, not about cold start. */
  init: () => ({
    filledAt: 0,
    forced: false,
    episode: false,
    fetching: false,
    fetchStartedAt: 0,
    waiters: [],
    fetchesThisEpisode: 0,
    peakWaiters: 0,
    pending: [],
    dbAcc: 0,
    hitEma: 1,
    latencyEma: HIT_MS,
    staleServed: 0,
    errors: 0,
    surgeUntil: 0,
  }),

  step: (state, dt, params) => {
    const L = state.lesson;
    const ttl = Number(params.ttl);
    const coalesce = params.coalesce === true;
    const swr = params.swr === true;
    const db = state.nodes.db;

    // 0. The EXPIRE button (momentary param — the engine sets it, we consume
    //    it). The scripted beat pulls the same lever at SURGE_AT, so a learner
    //    who never touches the button still sees the dogpile.
    if (params.expire === true) {
      params.expire = false;
      L.forced = true;
    }

    // 1. Is the hot key there? Two deliberate details:
    //    - expiry is checked by *age* at read time, so dragging the TTL slider
    //      bites immediately instead of waiting out a deadline stamped under
    //      the old value;
    //    - both are re-read per arrival, never snapshotted for the tick. A fill
    //      landing mid-tick has to be visible to the very next read in the same
    //      arrival batch, or the fetch it just satisfied would be issued twice
    //      and "exactly one fetch" would quietly be a lie.
    /** There is a copy — possibly an expired one — to serve. */
    const hasCopy = (): boolean => L.filledAt >= 0;
    const isExpired = (): boolean =>
      !hasCopy() || L.forced || state.t - L.filledAt >= ttl;

    // A fresh expiry opens an episode: the fetch counter is per-expiry, which
    // is the whole scoreboard — 1 with coalescing, dozens without.
    if (isExpired() && !L.episode) {
      L.episode = true;
      L.fetchesThisEpisode = 0;
      L.peakWaiters = 0;
    }

    // A fetch that never came home must not hold the lock forever.
    if (L.fetching && state.t - L.fetchStartedAt > LOCK_TIMEOUT) {
      L.fetching = false;
    }

    /** Send one read for the hot key to pg-main — or don't, if one is already out. */
    const startFetch = (mode: FetchMode): void => {
      if (coalesce && L.fetching) return; // single-flight: someone already went
      L.fetching = true;
      L.fetchStartedAt = state.t;
      L.fetchesThisEpisode += 1;
      spawnPacket(state, "back", "miss", {
        speed: 1.8,
        payload: { hot: true, mode },
      });
    };

    /**
     * Everyone parked at the cache, released at once. `served` false means the
     * fetch they were all waiting on failed — the sharp edge of single-flight:
     * one failure is everyone's failure.
     */
    const releaseWaiters = (served: boolean): void => {
      const drawn = Math.min(L.waiters.length, RELEASE_BURST);
      for (let i = 0; i < L.waiters.length; i++) {
        if (served) {
          // Their wait is real sim time; the cache round trip is the constant.
          L.latencyEma = emaEvent(
            L.latencyEma,
            HIT_MS + (state.t - L.waiters[i]) * 1000,
            LAT_EMA_RATE,
          );
        } else {
          L.errors += 1;
        }
        if (i < drawn) {
          spawnPacket(state, "front", served ? "response" : "drop", {
            speed: 2,
            reverse: true,
            size: served ? undefined : 3,
          });
        }
      }
      // One sample for the whole release, not one per waiter: they were all
      // answered at the same instant, and forty samples would draw a cliff on
      // the sparkline where the truth is a single point.
      if (served && L.waiters.length > 0) {
        recordSample(state, "latency", L.latencyEma);
      }
      L.waiters.length = 0;
    };

    // 2. Reads arrive. 70% of them want the one key everybody wants.
    const rate =
      state.t < L.surgeUntil
        ? Math.max(Number(params.traffic), SURGE_RATE)
        : Number(params.traffic);
    const spawns = shouldSpawn(state, rate, dt);
    for (let i = 0; i < spawns; i++) {
      const hot = state.rng() < HOT_SHARE;
      spawnPacket(state, "front", "request", { speed: 2, payload: { hot } });
    }

    // 3. Deliveries.
    for (const p of advancePackets(state, dt)) {
      const hot = p.payload?.hot === true;

      if (p.edgeId === "front" && p.type === "request") {
        if (!hot) {
          // Background key: warm set, fixed hit ratio. Its misses share the
          // database queue with the hot key's — that's the collateral.
          if (state.rng() < BG_HIT) {
            L.hitEma = emaEvent(L.hitEma, true, HIT_EMA_RATE);
            L.latencyEma = emaEvent(L.latencyEma, HIT_MS, LAT_EMA_RATE);
            recordSample(state, "latency", L.latencyEma);
            spawnPacket(state, "front", "hit", { speed: 2, reverse: true });
          } else {
            L.hitEma = emaEvent(L.hitEma, false, HIT_EMA_RATE);
            spawnPacket(state, "back", "miss", {
              speed: 1.8,
              payload: { hot: false, mode: "single" },
            });
          }
        } else if (!isExpired()) {
          // The happy case, and the case the TTL is stealing from you.
          L.hitEma = emaEvent(L.hitEma, true, HIT_EMA_RATE);
          L.latencyEma = emaEvent(L.latencyEma, HIT_MS, LAT_EMA_RATE);
          recordSample(state, "latency", L.latencyEma);
          spawnPacket(state, "front", "hit", { speed: 2, reverse: true });
        } else if (swr && hasCopy()) {
          // Stale-while-revalidate: the reader gets the old value NOW, at
          // cache speed, and a refresh runs behind it. Note what this does and
          // does not fix — without coalescing, every one of these fires its
          // own refresh. Nobody waits; pg-main still gets the herd.
          L.staleServed += 1;
          L.hitEma = emaEvent(L.hitEma, true, HIT_EMA_RATE);
          L.latencyEma = emaEvent(L.latencyEma, HIT_MS, LAT_EMA_RATE);
          recordSample(state, "latency", L.latencyEma);
          spawnPacket(state, "front", "stale", { speed: 2, reverse: true });
          startFetch("refresh");
        } else {
          // No usable copy: this reader has to wait for the truth. The only
          // question is whether it waits *here* or at the database.
          L.hitEma = emaEvent(L.hitEma, false, HIT_EMA_RATE);
          if (coalesce) {
            L.waiters.push(state.t); // parked: a number, not a dot
            L.peakWaiters = Math.max(L.peakWaiters, L.waiters.length);
            startFetch("coalesced");
          } else {
            startFetch("single");
          }
        }
      } else if (p.edgeId === "back" && p.type === "miss") {
        // Arrived at pg-main.
        const mode = (p.payload?.mode as FetchMode | undefined) ?? "single";
        if (db.health === "dead") {
          // Out of connections: refused at the door, loudly.
          L.errors += 1;
          bounceDrop(state, "back", { reverse: true });
          if (hot) {
            L.fetching = false; // the flight failed; never strand the lock
            if (mode === "coalesced") releaseWaiters(false);
          }
        } else {
          L.pending.push({ hot, mode, enqueuedAt: state.t });
        }
      } else if (p.edgeId === "back" && p.type === "response") {
        // A fill coming home. Whatever mode it went out as, its arrival ends
        // the wait for everybody — a param flipped mid-flight can't strand
        // readers.
        if (hot) {
          L.filledAt = state.t;
          L.forced = false;
          L.episode = false;
          L.fetching = false;
          const mode = (p.payload?.mode as FetchMode | undefined) ?? "single";
          if (mode === "single") {
            const waitMs = Number(p.payload?.waitMs ?? 0);
            L.latencyEma = emaEvent(L.latencyEma, MISS_MS + waitMs, LAT_EMA_RATE);
            recordSample(state, "latency", L.latencyEma);
            spawnPacket(state, "front", "response", { speed: 2, reverse: true });
          }
          releaseWaiters(true);
        } else {
          spawnPacket(state, "front", "response", { speed: 2, reverse: true });
        }
      }
      // "hit"/"stale"/"response"/"drop" arriving at the client are just home.
    }

    // 4. pg-main works its queue off — slower the deeper the queue is, because
    //    a thrashing database is not a fast one.
    const capacity =
      L.pending.length >= DEGRADE_DEPTH
        ? DB_CAPACITY * DEGRADED_FACTOR
        : DB_CAPACITY;
    const queue = { depth: L.pending.length, acc: L.dbAcc };
    drainQueue(queue, capacity, dt, () => {
      const read = L.pending.shift()!;
      const waitMs = (state.t - read.enqueuedAt) * 1000;
      if (!read.hot) {
        L.latencyEma = emaEvent(L.latencyEma, MISS_MS + waitMs, LAT_EMA_RATE);
        recordSample(state, "latency", L.latencyEma);
      }
      spawnPacket(state, "back", "response", {
        speed: 1.8,
        reverse: true,
        payload: { hot: read.hot, mode: read.mode, waitMs },
      });
    });
    L.dbAcc = queue.acc;

    // 5. Health, read straight off the queue depth — nothing kills pg-main
    //    here by clicking it; it is buried by the herd or it is fine.
    const depth = L.pending.length;
    if (db.health === "dead") {
      if (depth <= RECOVER_DEPTH) db.health = "healthy";
    } else if (depth >= COLLAPSE_DEPTH) {
      db.health = "dead";
    } else {
      db.health = depth >= DEGRADE_DEPTH ? "degraded" : "healthy";
    }

    // 6. Readouts.
    db.queueDepth = depth;
    db.load = approach(db.load, clamp01(depth / COLLAPSE_DEPTH), 6, dt);

    const cache = state.nodes.cache;
    cache.queueDepth = L.waiters.length;
    cache.load = approach(
      cache.load,
      clamp01(L.waiters.length / WAITERS_FULL),
      6,
      dt,
    );
    // The TTL bar over redis-1 (see the figure's nodeOverlay).
    const gone = isExpired();
    const meta = (cache.meta ??= {});
    meta.ttlLeft = gone ? 0 : Math.max(0, ttl - (state.t - L.filledAt));
    meta.ttl = ttl;
    meta.servingStale = gone && hasCopy() && swr;

    state.metrics.hitRatio = L.hitEma * 100;
    state.metrics.fetches = L.fetchesThisEpisode;
    state.metrics.latency = L.latencyEma;
    state.metrics.dbLoad = db.load * 100;
    state.metrics.failed = L.errors;
  },

  workbench: {
    experiment: {
      id: "force-one-expiry",
      title: "Force one hot-key expiry",
      prompt:
        "Start the warm cache, then increase traffic and expire the hot key to see how one missing value can multiply database work.",
      actionLabel: "Start the cache",
      focusId: "warm-hot-key",
      action: { kind: "play" },
    },
    focuses: [
      {
        id: "warm-hot-key",
        label: "One hot key normally shields the database",
        phase: "baseline",
        at: 2,
        nodes: ["client", "cache", "db"],
        edges: ["front", "back"],
        metrics: ["fetches", "hitRatio", "dbLoad"],
        summary:
          "While the hot key is fresh, many readers are served by redis-1 and pg-main sees neither the repeated lookup nor its latency.",
        nextAction: "Wait for an expiry, then compare fetches per expiry with the number of readers.",
      },
      {
        id: "hot-key-expiry",
        label: "An expiry turns identical reads into a herd",
        phase: "change",
        at: 12,
        nodes: ["client", "cache", "db"],
        edges: ["front", "back"],
        metrics: ["fetches", "latency", "dbLoad"],
        summary:
          "Expiring the shared value during traffic removes the common answer, so every arriving reader has an opportunity to start the same database fetch.",
        nextAction: "Raise traffic and press expire hot key, then count fetches before the key refills.",
        trigger: { kind: "button-press", id: "expire" },
      },
      {
        id: "dogpile-pressure",
        label: "Duplicate fetches become collateral damage",
        phase: "impact",
        at: 19,
        nodes: ["cache", "db"],
        edges: ["back"],
        metrics: ["fetches", "latency", "dbLoad", "failed"],
        summary:
          "The dogpile sends many copies of one read to pg-main, growing its queue and delaying unrelated traffic until the database degrades or fails.",
        nextAction: "Use fetches per expiry to connect the one missing value to the database queue.",
      },
      {
        id: "single-flight-and-stale",
        label: "Mitigate work and waiting separately",
        phase: "resolution",
        at: 27,
        nodes: ["client", "cache", "db"],
        edges: ["front", "back"],
        metrics: ["fetches", "latency", "dbLoad"],
        summary:
          "Coalescing lets one fetch refresh the value while other readers wait at the cache; stale-while-revalidate serves the old value immediately while refresh work continues.",
        nextAction: "Enable coalescing, expire the key again, then add stale-while-revalidate and compare load with latency.",
        trigger: { kind: "param-change", id: "coalesce" },
      },
    ],
  },

  timeline: [
    {
      at: 2,
      caption:
        "One hot key, one TTL. The bar over redis-1 is the time it has left; green is a hit that never touches pg-main.",
    },
    {
      // The first natural expiry, whenever it happens — the gate waits for the
      // fetch counter to actually move rather than trusting the clock.
      at: 6,
      when: (s) => s.lesson.fetchesThisEpisode >= 3,
      caption:
        "It expired. Every read that arrived before the refill landed went to pg-main — a handful of fetches for one value. Wasteful, but pg-main shrugs it off at this traffic.",
    },
    {
      at: 12,
      caption:
        "Now push TRAFFIC up and press EXPIRE HOT KEY. Watch fetches / expiry.",
    },
    {
      // The learner-triggered dogpile, before the script gets there.
      at: 0,
      when: (s, p) =>
        s.t < SURGE_AT &&
        p.coalesce !== true &&
        s.lesson.fetchesThisEpisode >= 12,
      caption:
        "☠ That is the dogpile: one key gone, and every reader that missed it opened its own read against pg-main.",
    },
    {
      at: SURGE_AT,
      caption: "Traffic is climbing to peak. The hot key is still holding.",
      apply: (s) => {
        s.lesson.surgeUntil = SURGE_UNTIL;
      },
    },
    {
      at: EXPIRE_AT,
      caption: "⚡ Peak traffic — and the hot key just expired.",
      apply: (s) => {
        s.lesson.surgeUntil = Math.max(s.lesson.surgeUntil, SURGE_UNTIL);
        s.lesson.forced = true;
      },
    },
    {
      at: EXPIRE_AT + 4,
      when: (s) => s.lesson.pending.length > DEGRADE_DEPTH,
      caption:
        "A second of dogpile, ten seconds of queue — and every other key's reads are stuck behind it.",
    },
    {
      at: SURGE_UNTIL + 0.5,
      caption:
        "Traffic backs off. Now turn COALESCING on and press EXPIRE HOT KEY again — same expiry, one fetch.",
    },
    {
      // The proof, whenever the learner gets there.
      at: 0,
      when: (s, p) =>
        p.coalesce === true &&
        s.lesson.fetchesThisEpisode === 1 &&
        s.lesson.peakWaiters >= 4,
      caption:
        "One fetch. The chip on redis-1 is everyone else — parked, waiting on it, served the moment it lands.",
    },
    {
      at: 0,
      when: (s, p) => p.swr === true && s.lesson.staleServed >= 8,
      caption:
        "Nobody waited at all: they were handed the old value while the refresh ran. Violet = stale.",
    },
  ],

  quiz: [
    {
      id: "stampede-coalesce",
      // 1.8s after the scripted expiry: the dogpile has just finished
      // streaming (the counter has stopped climbing at ~20 fetches for the one
      // key) and pg-main's queue is at ~15 and degraded — the premise is
      // literally on screen. Well before the surge resolves at 26.5.
      at: 19.8,
      question:
        "The hot key just expired at peak traffic, and fetches / expiry is what pg-main took for that one key — one read per reader that missed it. With COALESCING on, how many of those readers would reach pg-main?",
      choices: [
        {
          id: "one",
          label: "Exactly one — the rest wait at the cache and are served by that fetch",
        },
        {
          id: "all",
          label: "All of them — coalescing dedupes writes, not reads",
        },
        {
          id: "zero",
          label: "Zero — a coalesced key is served stale until someone writes it",
        },
      ],
      correctChoiceId: "one",
      explain:
        "Single-flight: the first miss takes a lock and goes; every reader behind it parks at the cache — that is the count chip on redis-1, and at this traffic it reads a couple of dozen — then the one fetch's answer is handed to all of them at once. Twenty-odd readers, one read, and the counter stays at 1. The third answer describes the *other* switch: stale-while-revalidate hands out the expired copy instead of parking anyone, so it fixes latency rather than load. They compose, and most real caches run both.",
    },
  ],

  meters: [
    {
      // The scoreboard. 1 is the target; anything else is duplicated work.
      metricKey: "fetches",
      label: "fetches / expiry",
      kind: "counter",
      dangerAbove: 3,
    },
    {
      metricKey: "hitRatio",
      label: "hit ratio",
      kind: "gauge",
      max: 100,
      unit: "%",
      dangerBelow: 50,
    },
    {
      metricKey: "latency",
      label: "avg latency",
      kind: "sparkline",
      unit: "ms",
      dangerAbove: 500,
    },
    {
      metricKey: "dbLoad",
      label: "db load",
      kind: "bar",
      max: 100,
      dangerAbove: 80,
    },
    {
      // The only readout that survives the recovery: the hit gauge and the
      // load bar both snap back, but reads that got an error stay counted.
      metricKey: "failed",
      label: "failed reads",
      kind: "counter",
      dangerAbove: 0,
    },
  ],

  packetStyles: {
    /** A stale answer is still an answer — but it is not a fresh one. */
    stale: { color: "var(--color-glow-violet)" },
  },
};
