import {
  advancePackets,
  approach,
  clamp01,
  drainQueue,
  emaEvent,
  isAlive,
  killNode,
  recordSample,
  reviveNode,
  shouldSpawn,
  spawnPacket,
} from "@/engine/sim-helpers";
import type { LessonSim } from "@/engine/types";

/**
 * Lesson 4 — Caching. A cache in front of a slow database.
 * Requests carry keys (zipf-ish hot/cold distribution); hits bounce straight
 * back green, misses trek on to the DB amber and populate the cache on the
 * way home. Learner tunes size and TTL against the hit-ratio dial — then
 * kills redis-1 and watches the thundering herd land on pg-main.
 */

interface CacheEntry {
  key: number;
  expiresAt: number;
  lastUsed: number;
}

/** A miss parked at the database, stamped so its queue wait is measurable. */
interface PendingRead {
  key: number;
  enqueuedAt: number;
}

interface CachingState {
  entries: CacheEntry[];
  /** FIFO of reads waiting at the DB (doubles as the DB queue depth). */
  pending: PendingRead[];
  dbAcc: number;
  hitEma: number; // 0..1
  latencyEma: number; // ms
  hits: number;
  misses: number;
  /** Latch on redis-1's death, so the flush runs once per outage. */
  down: boolean;
}

const KEYSPACE = 16;
/**
 * The 80/20 of real read traffic: three hot keys take ~72% of every read, the
 * other thirteen share the rest. That is what makes a five-entry cache worth
 * having — it holds the hot set and lands near a 60% hit ratio, so the miss
 * stream (~3/s) sits at half of the database's 6/s. That headroom is the
 * point: it is exactly what redis-1's death takes away.
 */
const HOT_KEYS = 3;
const HOT_SHARE = 0.72;
/**
 * Expiries are spread over ±20% of the TTL. Without the jitter the hot set —
 * populated within a second of each other — expires together and stampedes
 * the database on a 10-second metronome, which drowns out the outage this
 * lesson is actually about. (Jittering TTLs is the real-world fix too.)
 */
const TTL_JITTER = 0.2;
const HIT_MS = 60;
const MISS_MS = 60 + 340;
/** The database is deliberately the slow part: 6 req/s against 8 req/s reads. */
const DB_CAPACITY = 6;
/**
 * Queue depth that reads as a fully-loaded database. Sized for the outage,
 * not the calm: with the cache up the queue barely leaves zero, so the bar
 * only means something once reads start stacking up behind pg-main.
 */
const DB_QUEUE_FULL = 12;

/**
 * Per-event EMA rates — both MUST stay below 1. `emaEvent` pins dt to 1 and
 * `approach` clamps its blend factor there, so a rate >= 1 latches onto the
 * newest sample: the hit-ratio gauge would only ever read 0% or 100%.
 */
const HIT_EMA_RATE = 0.12;
const LAT_EMA_RATE = 0.3;

/**
 * The outage beats. The learner is invited to pull the trigger themselves at
 * INVITE_AT; KILL_AT is the backstop that guarantees the prediction gets
 * proved either way (killing a dead node is a no-op, so the two never fight).
 */
const INVITE_AT = 24;
const KILL_AT = 29;
const REVIVE_AT = 33;

/** One read's key: hot set first, long tail otherwise. Two seeded draws. */
function drawKey(rng: () => number): number {
  return rng() < HOT_SHARE
    ? Math.floor(rng() * HOT_KEYS)
    : HOT_KEYS + Math.floor(rng() * (KEYSPACE - HOT_KEYS));
}

export const cachingSim: LessonSim<CachingState> = {
  id: "caching",

  topology: {
    nodes: [
      { id: "client", kind: "client", label: "app", x: 130, y: 225 },
      {
        id: "cache",
        kind: "cache",
        label: "redis-1",
        x: 400,
        y: 225,
        breakable: true,
      },
      { id: "db", kind: "database", label: "pg-main", x: 660, y: 225 },
    ],
    edges: [
      { id: "front", from: "client", to: "cache" },
      { id: "back", from: "cache", to: "db" },
    ],
  },

  params: [
    {
      key: "size",
      label: "cache size",
      kind: "slider",
      min: 2,
      max: 12,
      step: 1,
      unit: " keys",
      // Two slots past the hot set: the hot keys stay resident, so TTL (not
      // eviction) is what limits the hit ratio and both sliders bite.
      defaultValue: 5,
    },
    {
      key: "ttl",
      label: "ttl",
      kind: "slider",
      min: 2,
      max: 30,
      step: 2,
      unit: "s",
      defaultValue: 6,
    },
    {
      key: "rate",
      label: "read rate",
      kind: "slider",
      min: 2,
      max: 20,
      step: 1,
      unit: " req/s",
      defaultValue: 8,
    },
  ],

  init: () => ({
    entries: [],
    pending: [],
    dbAcc: 0,
    hitEma: 0.5,
    latencyEma: HIT_MS,
    hits: 0,
    misses: 0,
    down: false,
  }),

  step: (state, dt, params) => {
    const L = state.lesson;
    const size = Number(params.size);
    const ttl = Number(params.ttl);
    const cacheUp = isAlive(state, "cache");

    // 0. A dead cache is an empty cache — RAM does not survive the process.
    //    Latched, so the flush happens once per outage and the revived node
    //    warms back up organically through ordinary misses.
    if (!cacheUp && !L.down) {
      L.entries = [];
      L.down = true;
    } else if (cacheUp && L.down) {
      L.down = false;
    }

    // 1. Reads arrive, each for a key — mostly for one of the hot three.
    const spawns = shouldSpawn(state, Number(params.rate), dt);
    for (let i = 0; i < spawns; i++) {
      const key = drawKey(state.rng);
      spawnPacket(state, "front", "request", { speed: 2, payload: { key } });
    }

    // 2. Deliveries.
    for (const p of advancePackets(state, dt)) {
      const key = Number(p.payload?.key ?? 0);
      if (p.edgeId === "front" && p.type === "request") {
        // At the cache: hit or miss? A dead redis-1 answers nothing, so every
        // read behind it becomes a miss and takes the long road.
        const entry = cacheUp
          ? L.entries.find((e) => e.key === key && e.expiresAt > state.t)
          : undefined;
        if (entry) {
          entry.lastUsed = state.t;
          L.hits += 1;
          L.hitEma = emaEvent(L.hitEma, true, HIT_EMA_RATE);
          L.latencyEma = emaEvent(L.latencyEma, HIT_MS, LAT_EMA_RATE);
          recordSample(state, "latency", L.latencyEma);
          spawnPacket(state, "front", "hit", { speed: 2, reverse: true });
        } else {
          L.misses += 1;
          L.hitEma = emaEvent(L.hitEma, false, HIT_EMA_RATE);
          // Latency for a miss is booked when the DB actually serves it —
          // that is the only moment its queue wait is known.
          spawnPacket(state, "back", "miss", { speed: 1.8, payload: { key } });
        }
      } else if (p.edgeId === "back" && p.type === "miss") {
        L.pending.push({ key, enqueuedAt: state.t }); // reached the DB
      } else if (p.edgeId === "back" && p.type === "response") {
        // DB answer arrives back at the cache: populate (LRU evict) — unless
        // the cache is dead, in which case the answer just passes through.
        if (cacheUp) {
          L.entries = L.entries.filter((e) => e.expiresAt > state.t);
          if (!L.entries.some((e) => e.key === key)) {
            if (L.entries.length >= size) {
              L.entries.sort((a, b) => a.lastUsed - b.lastUsed).shift();
            }
            const jitter = 1 + (state.rng() * 2 - 1) * TTL_JITTER;
            L.entries.push({
              key,
              expiresAt: state.t + ttl * jitter,
              lastUsed: state.t,
            });
          }
        }
        spawnPacket(state, "front", "response", { speed: 2, reverse: true });
      }
    }

    // 3. The DB is slow: DB_CAPACITY req/s. The queue here is the pending FIFO
    //    itself, so drainQueue drives a depth mirror and each serve pops the
    //    matching read — booking the round trip *plus* its queue wait. That
    //    wait is the term that runs away once the cache stops absorbing reads.
    const db = { depth: L.pending.length, acc: L.dbAcc };
    drainQueue(db, DB_CAPACITY, dt, () => {
      const read = L.pending.shift()!;
      const waitMs = (state.t - read.enqueuedAt) * 1000;
      L.latencyEma = emaEvent(L.latencyEma, MISS_MS + waitMs, LAT_EMA_RATE);
      recordSample(state, "latency", L.latencyEma);
      spawnPacket(state, "back", "response", {
        speed: 1.8,
        reverse: true,
        payload: { key: read.key },
      });
    });
    L.dbAcc = db.acc;

    // 4. Readouts.
    L.entries = L.entries.filter((e) => e.expiresAt > state.t);
    state.nodes.cache.queueDepth = L.entries.length;
    state.nodes.cache.load = cacheUp
      ? approach(state.nodes.cache.load, clamp01(L.entries.length / size), 6, dt)
      : 0;
    state.nodes.db.queueDepth = L.pending.length;
    state.nodes.db.load = approach(
      state.nodes.db.load,
      clamp01(L.pending.length / DB_QUEUE_FULL),
      6,
      dt,
    );
    state.metrics.hitRatio = L.hitEma * 100;
    state.metrics.latency = L.latencyEma;
    state.metrics.dbLoad = state.nodes.db.load * 100;
  },

  workbench: {
    experiment: {
      id: "follow-a-cache-read",
      title: "Follow one cache read",
      prompt:
        "Start the read stream and distinguish the fast cache-hit path from the slower database-miss path before changing the cache policy.",
      actionLabel: "Start reads",
      focusId: "hit-and-miss",
      action: { kind: "play" },
    },
    focuses: [
      {
        id: "hit-and-miss",
        label: "A hit removes the database path",
        phase: "baseline",
        at: 2,
        nodes: ["client", "cache", "db"],
        edges: ["front", "back"],
        metrics: ["hitRatio", "latency", "dbLoad"],
        summary:
          "Each read first reaches redis-1; a hit returns quickly, while a miss continues to pg-main and consumes database capacity.",
        nextAction: "Compare the short front path with the long back path before changing policy.",
      },
      {
        id: "freshness-tradeoff",
        label: "TTL trades freshness for fewer misses",
        phase: "change",
        at: 18,
        nodes: ["cache", "db"],
        edges: ["back"],
        metrics: ["hitRatio", "latency", "dbLoad"],
        summary:
          "A shorter TTL invalidates entries sooner, reducing the chance of stale data but sending more reads through the database path.",
        nextAction: "Change TTL and explain the hit-ratio change together with its freshness cost.",
        trigger: { kind: "param-change", id: "ttl" },
      },
      {
        id: "cache-outage",
        label: "Cache loss multiplies database work",
        phase: "impact",
        at: 25,
        nodes: ["client", "cache", "db"],
        edges: ["front", "back"],
        metrics: ["hitRatio", "latency", "dbLoad"],
        summary:
          "When redis-1 is unavailable, every read becomes a database miss, exposing the work the cache had been absorbing and allowing the database queue to grow.",
        nextAction: "Use the database-load and latency meters to quantify the amplification.",
      },
      {
        id: "cold-cache-recovery",
        label: "Recovery starts cold, not warm",
        phase: "resolution",
        at: 31,
        nodes: ["cache", "db"],
        edges: ["back"],
        metrics: ["hitRatio", "latency", "dbLoad"],
        summary:
          "Reviving the cache restores a place to store answers, but it returns empty, so database pressure persists until ordinary misses rebuild a useful working set.",
        nextAction: "Let the cache refill and observe why the database backlog can outlive the outage.",
      },
    ],
  },

  timeline: [
    {
      at: 2,
      caption:
        "Green = cache hit (fast). Amber = miss — the long trek to the database.",
    },
    {
      at: 8,
      caption:
        "The count chip on redis-1 is how many keys it holds. Grow CACHE SIZE and watch the dial.",
    },
    {
      at: 18,
      caption: "Now shrink TTL to 2s — freshness has a price.",
    },
    {
      at: INVITE_AT,
      caption: "☠ Kill redis-1 — watch what the database absorbs.",
      // Only an invitation while there is something left to kill, and only
      // while it is still this beat: past KILL_AT the script does it anyway.
      when: (s) => s.t < KILL_AT && isAlive(s, "cache"),
    },
    {
      at: KILL_AT,
      caption:
        "☠ redis-1 is dark. Every read is a miss now — the whole herd hits pg-main.",
      apply: (s) => killNode(s, "cache"),
    },
    {
      at: REVIVE_AT,
      caption:
        "redis-1 is back — and empty. The herd keeps running until it refills.",
      apply: (s) => reviveNode(s, "cache"),
    },
    {
      at: REVIVE_AT + 7,
      caption:
        "The backlog outlives the outage: every queued read waits, so misses pile on faster than pg-main can dig out.",
      // Only worth saying while pg-main is genuinely still buried, and only
      // as part of this recovery — not as a late echo of some later outage.
      when: (s) =>
        s.t < REVIVE_AT + 20 && s.lesson.pending.length > DB_QUEUE_FULL / 2,
    },
  ],

  quiz: [
    {
      id: "cache-ttl",
      at: 14,
      question:
        "You double the TTL. What happens to the hit ratio — and what's the hidden cost?",
      choices: [
        { id: "a", label: "Hit ratio rises; entries may serve stale data longer" },
        { id: "b", label: "Hit ratio rises; there is no cost, longer is free" },
        { id: "c", label: "No change — TTL only affects memory usage" },
      ],
      correctChoiceId: "a",
      explain:
        "A longer TTL keeps entries alive longer, so more reads hit. But every extra second an entry lives is a second the underlying data may have changed — TTL is exactly the knob that trades freshness for speed.",
    },
    {
      id: "cache-herd",
      at: 23,
      question:
        "The cache dies at a 60% hit ratio. What happens to database load?",
      choices: [
        { id: "same", label: "Unchanged — the cache only ever added speed" },
        { id: "plus40", label: "Up by the 40% it was already serving" },
        { id: "x25", label: "Roughly 2.5× — every read becomes a database read" },
      ],
      correctChoiceId: "x25",
      explain:
        "The database was only seeing the misses: 40% of reads. Now it sees 100% — that is 1 / (1 − 0.6) = 2.5× its old load. The multiplier is brutal at the top: a 90% hit ratio is hiding a 10× amplification behind it. pg-main tops out at 6 req/s, so past its ceiling the queue just grows and every read waits behind it.",
      // Fires only while the premise is literally on screen: cache alive,
      // gauge near 60%, and before the scripted death proves the answer.
      when: (s) =>
        s.t < KILL_AT &&
        isAlive(s, "cache") &&
        s.metrics.hitRatio >= 54 &&
        s.metrics.hitRatio <= 66,
    },
  ],

  meters: [
    {
      metricKey: "hitRatio",
      label: "hit ratio",
      kind: "gauge",
      max: 100,
      unit: "%",
      dangerBelow: 35,
    },
    {
      metricKey: "latency",
      label: "avg latency",
      kind: "sparkline",
      unit: "ms",
      // Past a plain miss means reads are queueing behind pg-main, not just
      // missing — which is exactly the trace the sparkline is there to show.
      dangerAbove: 500,
    },
    {
      metricKey: "dbLoad",
      label: "db load",
      kind: "bar",
      max: 100,
      dangerAbove: 80,
    },
  ],
};
