import {
  advancePackets,
  approach,
  bounceDrop,
  clamp01,
  emaEvent,
  emaRate,
  isAlive,
  killNode,
  reviveNode,
  shouldSpawn,
  spawnPacket,
} from "@/engine/sim-helpers";
import type { LessonSim } from "@/engine/types";

/**
 * Lesson — CDN & Edge Caching. Three regions, three PoPs, one origin.
 *
 * The stage is a map: clients down the left, a PoP a short hop away from each
 * of them, and one origin far to the right. Distance is spent in packet speed —
 * an edge hop is 0.42 sim-seconds, an origin leg a full second — so "close" and
 * "far" are things you watch rather than read.
 *
 * Two failure stories, deliberately different in shape:
 *   1. A PoP dies (t=13.5) → only its region suffers, and it suffers
 *      *immediately*: every apac request now runs the full distance itself,
 *      ~3x the latency. The other two regions never feel it — failure isolated
 *      by geography.
 *   2. The origin dies (t=23) → nobody notices, because every PoP is still
 *      inside its TTL. The damage arrives later, region by region, as each
 *      cached copy lapses and the refill finds nobody home.
 *
 * That delay is the whole lesson, and its length is the TTL: at seed 42 with
 * the defaults, the origin dies at t=23 with nothing in flight, the first user
 * sees an error at t=28.6, and the last region falls over at t=30. A CDN buys
 * you time, not immortality.
 */

const REGIONS = ["west", "eu", "apac"] as const;
type RegionId = (typeof REGIONS)[number];

const ORIGIN = "origin";
const clientId = (r: RegionId) => `cli-${r}`;
const popId = (r: RegionId) => `pop-${r}`;
/** client → PoP (short). */
const hopEdge = (r: RegionId) => `hop-${r}`;
/** PoP → origin (long). */
const longEdge = (r: RegionId) => `long-${r}`;
/** client → origin, bypassing the edge entirely (long). */
const farEdge = (r: RegionId) => `far-${r}`;
/** Per-region latency readout; also what the client chips display. */
const latKey = (r: RegionId) => `lat-${r}`;

/** Objects each PoP can hold — one small static catalogue. */
const ASSETS = 3;

/**
 * Travel speeds, in progress-units per sim-second. Latency in this lesson is
 * *measured*, not asserted: every packet carries the sim time its client
 * request was born, and the round trip is stamped on arrival. So these three
 * numbers are the geography — change one and every meter follows.
 *
 *   edge hop     0.42s each way  →   ~83 ms round trip, the whole point of a PoP
 *   origin leg   1.00s each way  →  ~283 ms for a miss served through a PoP
 *   direct haul  1.60s each way  →  ~320 ms with no edge in the path at all
 *
 * The two long legs run at the same *pixel* speed (~390 px/s): the client's
 * detour is slower than the PoP's backhaul because it is longer, not because
 * the link is worse. The edge hop is short AND quick — that is the sale.
 */
const HOP_SPEED = 2.4;
const LONG_SPEED = 1.0;
const FAR_SPEED = 0.625;
/** Refusals come back fast — an error is cheap to deliver. */
const DROP_SPEED = 1.6;
/** Sim-seconds → the millisecond figure the chips and meters show. */
const MS_PER_SEC = 100;

/** ±6% on every TTL, so nothing in this system expires in perfect lockstep. */
const TTL_JITTER = 0.06;

/**
 * After a refused fetch a PoP waits this long before trying the origin again.
 * Without it a dead origin would be hammered once per tick per lapsed object;
 * with it, the outage reads as a slow pulse of red instead of a firehose.
 */
const RETRY_BACKOFF = 2;

/**
 * Per-*event* EMA rates — both MUST stay under 1 (`emaEvent` pins dt to 1 and
 * `approach` clamps the blend at 1, so rate >= 1 latches onto the last sample).
 */
const HIT_EMA_RATE = 0.04;
const LAT_EMA_RATE = 0.15;

/** Origin req/s that reads as a fully-loaded origin (3 regions × max rate). */
const ORIGIN_FULL = 18;

/** Red packets echoed back per failed fetch — the pool is not a crowd meter. */
const MAX_ERROR_ECHO = 3;

/* The scripted beats. Both kills are also available to the learner at any
   time by clicking a node; killing a corpse is a no-op, so they never fight. */
const POP_KILL_AT = 13.5;
const POP_REVIVE_AT = 19;
const ORIGIN_KILL_AT = 23;
const QUIZ_AT = 23.5;

/** A client request parked at a PoP while that key's refill is in flight. */
interface Waiter {
  key: number;
  /** Sim time the client sent it — the clock the latency sample is taken on. */
  t0: number;
}

interface PopCache {
  /** Per asset: sim time this copy goes stale. 0 = never held / lapsed. */
  expiresAt: number[];
  /** Per asset: a refill is already on the wire (collapsed forwarding). */
  fetching: boolean[];
  /**
   * Per asset: this PoP has served it before, so it revalidates the moment the
   * copy lapses instead of waiting to be asked again. A cold PoP knows
   * nothing — which is why the first request for anything is always a miss.
   */
  known: boolean[];
  /** Per asset: sim time this PoP may next bother the origin (see backoff). */
  retryAt: number[];
  waiting: Waiter[];
  /** Latch on this PoP's death, so the flush runs once per outage. */
  down: boolean;
}

interface CdnState {
  pops: Record<RegionId, PopCache>;
  /** Per-region smoothed round-trip time, in ms. */
  lat: Record<RegionId, number>;
  hitEma: number; // 0..1
  originRps: number;
  errors: number;
}

function emptyCache(): PopCache {
  return {
    expiresAt: new Array<number>(ASSETS).fill(0),
    fetching: new Array<boolean>(ASSETS).fill(false),
    known: new Array<boolean>(ASSETS).fill(false),
    retryAt: new Array<number>(ASSETS).fill(0),
    waiting: [],
    down: false,
  };
}

export interface CdnClientMeta {
  latencyMs: number;
}

export interface CdnPopMeta {
  /** Sim-seconds until this PoP's freshest copy lapses. */
  freshFor: number;
  /** freshFor as a fraction of the current TTL — the pill's drain bar. */
  freshFrac: number;
}

export const cdnEdgeSim: LessonSim<CdnState> = {
  id: "cdn-edge",

  topology: {
    nodes: [
      { id: "cli-west", kind: "client", label: "us-west", x: 88, y: 80 },
      { id: "cli-eu", kind: "client", label: "eu", x: 88, y: 225 },
      { id: "cli-apac", kind: "client", label: "apac", x: 88, y: 360 },
      {
        id: "pop-west",
        kind: "cache",
        label: "pop-sfo",
        x: 330,
        y: 80,
        breakable: true,
      },
      {
        id: "pop-eu",
        kind: "cache",
        label: "pop-fra",
        x: 330,
        y: 225,
        breakable: true,
      },
      {
        id: "pop-apac",
        kind: "cache",
        label: "pop-sin",
        x: 330,
        y: 360,
        breakable: true,
      },
      {
        id: ORIGIN,
        kind: "server",
        label: "origin",
        x: 690,
        y: 225,
        breakable: true,
      },
    ],
    edges: [
      // Short hops: a region and its PoP are neighbours.
      { id: "hop-west", from: "cli-west", to: "pop-west" },
      { id: "hop-eu", from: "cli-eu", to: "pop-eu" },
      { id: "hop-apac", from: "cli-apac", to: "pop-apac" },
      // Long hauls: every PoP back to the one origin.
      { id: "long-west", from: "pop-west", to: ORIGIN, curve: -0.12 },
      { id: "long-eu", from: "pop-eu", to: ORIGIN },
      { id: "long-apac", from: "pop-apac", to: ORIGIN, curve: 0.12 },
      // The detours: client straight to the origin, bowed clear of the PoPs.
      { id: "far-west", from: "cli-west", to: ORIGIN, curve: 0.1 },
      { id: "far-eu", from: "cli-eu", to: ORIGIN, curve: 0.6 },
      { id: "far-apac", from: "cli-apac", to: ORIGIN, curve: -0.28 },
    ],
  },

  params: [
    {
      key: "ttl",
      label: "edge ttl",
      kind: "slider",
      min: 2,
      max: 20,
      step: 1,
      unit: "s",
      // Seven seconds is the sweet spot for the scripted arc: long enough
      // that the edges carry ~80% of traffic, short enough that the origin
      // outage is survived and then visibly *not* survived in one sitting.
      defaultValue: 7,
    },
    {
      key: "content",
      label: "content",
      kind: "select",
      options: [
        { value: "static", label: "static" },
        { value: "dynamic", label: "dynamic" },
      ],
      defaultValue: "static",
    },
    {
      key: "rate",
      label: "traffic / region",
      kind: "slider",
      min: 1,
      max: 6,
      step: 1,
      unit: " req/s",
      defaultValue: 5,
    },
  ],

  init: () => ({
    pops: { west: emptyCache(), eu: emptyCache(), apac: emptyCache() },
    // Everyone starts at origin distance — nothing is cached yet, and the
    // first ten seconds exist to fix precisely that.
    lat: { west: 320, eu: 320, apac: 320 },
    hitEma: 0,
    originRps: 0,
    errors: 0,
  }),

  step: (state, dt, params) => {
    const L = state.lesson;
    const ttl = Number(params.ttl);
    const rate = Number(params.rate);
    const dynamic = params.content === "dynamic";
    const originUp = isAlive(state, ORIGIN);
    let originArrivals = 0;

    // 0. A dead PoP is an empty PoP — its RAM went with it. Requests parked
    //    there are not lost: the client retries the long way round, which is
    //    what the latency chip is about to show.
    for (const r of REGIONS) {
      const cache = L.pops[r];
      const up = isAlive(state, popId(r));
      if (!up && !cache.down) {
        cache.down = true;
        cache.expiresAt.fill(0);
        cache.fetching.fill(false);
        cache.known.fill(false);
        cache.retryAt.fill(0);
        for (const w of cache.waiting) {
          spawnPacket(state, farEdge(r), "bypass", {
            speed: FAR_SPEED,
            payload: { key: w.key, t0: w.t0 },
          });
        }
        cache.waiting = [];
      } else if (up && cache.down) {
        cache.down = false;
      }
    }

    // 1. Each region generates its own traffic. Dynamic content is never
    //    cacheable and a dark PoP cannot answer, so both take the long road.
    for (const r of REGIONS) {
      const spawns = shouldSpawn(state, rate, dt);
      for (let i = 0; i < spawns; i++) {
        const key = Math.floor(state.rng() * ASSETS);
        if (dynamic || !isAlive(state, popId(r))) {
          L.hitEma = emaEvent(L.hitEma, false, HIT_EMA_RATE);
          spawnPacket(state, farEdge(r), "bypass", {
            speed: FAR_SPEED,
            payload: { key, t0: state.t },
          });
        } else {
          spawnPacket(state, hopEdge(r), "request", {
            speed: HOP_SPEED,
            payload: { key, t0: state.t },
          });
        }
      }
    }

    // 2. Deliveries. Edge ids are `<leg>-<region>`, so the arrival tells us
    //    both where it landed and whose request it was.
    for (const p of advancePackets(state, dt)) {
      const dash = p.edgeId.indexOf("-");
      const leg = p.edgeId.slice(0, dash);
      const r = p.edgeId.slice(dash + 1) as RegionId;
      const cache = L.pops[r];
      const key = Number(p.payload?.key ?? 0);
      const t0 = Number(p.payload?.t0 ?? p.bornAt);

      if (leg === "hop") {
        if (p.type === "request") {
          if (!isAlive(state, popId(r))) {
            // The PoP went dark while this was on the wire: retry, long way.
            L.hitEma = emaEvent(L.hitEma, false, HIT_EMA_RATE);
            spawnPacket(state, farEdge(r), "bypass", {
              speed: FAR_SPEED,
              payload: { key, t0 },
            });
          } else if (cache.expiresAt[key] > state.t) {
            // Fresh copy, one hop away. This is what a CDN is for.
            L.hitEma = emaEvent(L.hitEma, true, HIT_EMA_RATE);
            spawnPacket(state, hopEdge(r), "hit", {
              speed: HOP_SPEED,
              reverse: true,
              payload: { key, t0 },
            });
          } else {
            // Stale or never held: park the request and fetch it once. A
            // second request for the same key rides the first refill.
            L.hitEma = emaEvent(L.hitEma, false, HIT_EMA_RATE);
            cache.waiting.push({ key, t0 });
            if (!cache.fetching[key] && state.t >= cache.retryAt[key]) {
              cache.fetching[key] = true;
              spawnPacket(state, longEdge(r), "miss", {
                speed: LONG_SPEED,
                payload: { key },
              });
            }
          }
        } else if (p.type === "hit" || p.type === "response") {
          // Home. The round trip it actually took is the latency sample.
          L.lat[r] = emaEvent(
            L.lat[r],
            (state.t - t0) * MS_PER_SEC,
            LAT_EMA_RATE,
          );
        }
        // A "drop" reaching the client was already counted at the origin.
      } else if (leg === "long") {
        if (p.type === "miss") {
          originArrivals += 1;
          if (originUp) {
            spawnPacket(state, longEdge(r), "response", {
              speed: LONG_SPEED,
              reverse: true,
              payload: { key },
            });
          } else {
            // Nobody home. Every request parked on this key fails together —
            // this is the moment the cache runs out of truth.
            const failed = cache.waiting.filter((w) => w.key === key).length;
            cache.waiting = cache.waiting.filter((w) => w.key !== key);
            cache.fetching[key] = false;
            cache.retryAt[key] = state.t + RETRY_BACKOFF;
            L.errors += failed;
            spawnPacket(state, longEdge(r), "drop", {
              speed: DROP_SPEED,
              reverse: true,
              size: 3,
              payload: { key, n: failed },
            });
          }
        } else if (p.type === "response") {
          // The refill landed: cache it, then answer everyone who waited.
          cache.fetching[key] = false;
          cache.known[key] = true;
          cache.expiresAt[key] =
            state.t + ttl * (1 + (state.rng() * 2 - 1) * TTL_JITTER);
          for (const w of cache.waiting) {
            if (w.key !== key) continue;
            spawnPacket(state, hopEdge(r), "response", {
              speed: HOP_SPEED,
              reverse: true,
              payload: { key, t0: w.t0 },
            });
          }
          cache.waiting = cache.waiting.filter((w) => w.key !== key);
        } else if (p.type === "drop") {
          // The refusal reached the PoP; hand it on to the people who asked.
          const n = Math.min(Number(p.payload?.n ?? 1), MAX_ERROR_ECHO);
          for (let i = 0; i < n; i++) {
            spawnPacket(state, hopEdge(r), "drop", {
              speed: DROP_SPEED,
              reverse: true,
              size: 3,
            });
          }
        }
      } else {
        // "far": a client's own long haul — dynamic content, or a dark PoP.
        if (p.type === "bypass") {
          originArrivals += 1;
          if (originUp) {
            spawnPacket(state, farEdge(r), "response", {
              speed: FAR_SPEED,
              reverse: true,
              payload: { key, t0 },
            });
          } else {
            L.errors += 1;
            bounceDrop(state, farEdge(r), { speed: DROP_SPEED });
          }
        } else if (p.type === "response") {
          L.lat[r] = emaEvent(
            L.lat[r],
            (state.t - t0) * MS_PER_SEC,
            LAT_EMA_RATE,
          );
        }
      }
    }

    // 2.5 Revalidation. A PoP does not wait to be asked twice: once it has
    //     served an object, it goes back for a fresh copy the moment the old
    //     one lapses. That is why the origin sees a steady heartbeat rather
    //     than a stampede — and why, with the origin gone, each PoP discovers
    //     the outage on its own TTL clock instead of all at once.
    for (const r of REGIONS) {
      if (!isAlive(state, popId(r))) continue;
      const cache = L.pops[r];
      for (let key = 0; key < ASSETS; key++) {
        if (!cache.known[key] || cache.fetching[key]) continue;
        if (cache.expiresAt[key] > state.t) continue;
        if (state.t < cache.retryAt[key]) continue;
        cache.fetching[key] = true;
        spawnPacket(state, longEdge(r), "miss", {
          speed: LONG_SPEED,
          payload: { key },
        });
      }
    }

    // 3. Readouts. Each PoP's load bar is how much of the catalogue it holds;
    //    the pill above it is how long its freshest copy has left to live.
    for (const r of REGIONS) {
      const cache = L.pops[r];
      const up = isAlive(state, popId(r));
      let fresh = 0;
      let freshFor = 0;
      for (const expiresAt of cache.expiresAt) {
        if (expiresAt > state.t) {
          fresh += 1;
          freshFor = Math.max(freshFor, expiresAt - state.t);
        }
      }
      const pop = state.nodes[popId(r)];
      pop.load = up ? approach(pop.load, clamp01(fresh / ASSETS), 6, dt) : 0;
      const popMeta: CdnPopMeta = {
        freshFor: up ? freshFor : 0,
        freshFrac: up ? clamp01(freshFor / Math.max(ttl, 1)) : 0,
      };
      pop.meta = { ...popMeta };
      const clientMeta: CdnClientMeta = { latencyMs: L.lat[r] };
      state.nodes[clientId(r)].meta = { ...clientMeta };
      state.metrics[latKey(r)] = L.lat[r];
    }

    L.originRps = emaRate(L.originRps, originArrivals, dt, 0.5);
    const origin = state.nodes[ORIGIN];
    origin.load = originUp
      ? approach(origin.load, clamp01(L.originRps / ORIGIN_FULL), 4, dt)
      : 0;

    state.metrics.hitRatio = L.hitEma * 100;
    state.metrics.originRps = L.originRps;
    state.metrics.errors = L.errors;
    state.metrics.slowest = Math.max(...REGIONS.map((r) => L.lat[r]));
  },

  workbench: {
    experiment: {
      id: "warm-the-edge-fleet",
      title: "Warm the edge fleet",
      prompt:
        "Start the regional requests and watch each point of presence turn a long origin trip into a short local response.",
      actionLabel: "Start regional traffic",
      focusId: "cold-edges",
      action: { kind: "play" },
    },
    focuses: [
      {
        id: "cold-edges",
        label: "Cold edges still depend on one origin",
        phase: "baseline",
        at: 1.5,
        nodes: ["cli-west", "cli-eu", "cli-apac", "pop-west", "pop-eu", "pop-apac", "origin"],
        edges: ["hop-west", "hop-eu", "hop-apac", "long-west", "long-eu", "long-apac"],
        metrics: ["hitRatio", "originRps", "slowest"],
        summary:
          "Before the PoPs hold a fresh copy, regional requests traverse from the edge fleet to the single origin and back.",
        nextAction: "Wait for the cache fills, then compare origin requests with the slowest regional latency.",
      },
      {
        id: "warm-edges",
        label: "A local copy removes the long haul",
        phase: "change",
        at: 6,
        nodes: ["cli-west", "cli-eu", "cli-apac", "pop-west", "pop-eu", "pop-apac"],
        edges: ["hop-west", "hop-eu", "hop-apac"],
        metrics: ["hitRatio", "originRps", "slowest"],
        summary:
          "Once a PoP is warm, it serves its local region in one short hop and shields the origin from repeated reads.",
        nextAction: "Switch content to dynamic and verify that cacheability, not distance alone, determines the path.",
        trigger: { kind: "param-change", id: "content" },
      },
      {
        id: "regional-bypass",
        label: "One failed PoP changes one region’s path",
        phase: "impact",
        at: POP_KILL_AT,
        nodes: ["cli-apac", "pop-apac", "origin"],
        edges: ["hop-apac", "far-apac"],
        metrics: ["slowest", "originRps", "errors"],
        summary:
          "When pop-sin fails, only APAC bypasses the edge and talks directly to origin; the other regional paths remain local.",
        nextAction: "Use the slowest-region metric to identify the localized blast radius.",
      },
      {
        id: "origin-shield",
        label: "Copies buy a timed grace period",
        phase: "resolution",
        at: ORIGIN_KILL_AT,
        nodes: ["pop-west", "pop-eu", "pop-apac", "origin"],
        edges: ["long-west", "long-eu", "long-apac"],
        metrics: ["hitRatio", "originRps", "errors"],
        summary:
          "After origin fails, fresh edge copies continue serving users until their independent TTLs expire; cached data is a temporary availability buffer, not a permanent substitute for origin.",
        nextAction: "Adjust edge TTL and observe the trade-off between a longer grace period and older content.",
        trigger: { kind: "param-change", id: "ttl" },
      },
    ],
  },

  timeline: [
    {
      at: 1.5,
      caption:
        "Cold edges: every request runs the full distance to the origin and back. Watch the PoPs fill.",
    },
    {
      at: 6,
      caption:
        "Warm. Green means served at the edge, one short hop from the user — and the origin barely sees a request.",
    },
    {
      at: 9,
      caption:
        "Try CONTENT: dynamic. Nothing is cacheable, so every request runs the long way and the origin absorbs all of it.",
    },
    {
      at: POP_KILL_AT,
      caption:
        "☠ pop-sin is dark. apac now talks to the origin itself — its latency triples. us-west and eu never feel it.",
      apply: (s) => killNode(s, popId("apac")),
    },
    {
      at: POP_REVIVE_AT,
      caption:
        "pop-sin is back — and empty. It refills from the origin one miss at a time.",
      apply: (s) => reviveNode(s, popId("apac")),
    },
    {
      at: ORIGIN_KILL_AT,
      caption: "☠ The origin is down. Look at the meters: nobody noticed.",
      apply: (s) => killNode(s, ORIGIN),
    },
    {
      at: QUIZ_AT + 0.5,
      caption:
        "Every PoP is serving copies of a machine that no longer exists. Watch the ttl pills drain.",
      when: (s) => !isAlive(s, ORIGIN),
    },
    {
      at: QUIZ_AT + 0.5,
      caption:
        "The first error. That edge's ttl lapsed, it went back for a fresh copy, and nobody answered — the cache just ran out of truth.",
      when: (s) => s.lesson.errors > 0,
    },
    {
      at: QUIZ_AT + 2,
      caption:
        "Region by region, as each ttl runs out. A longer ttl would have held longer — and served older bytes the whole time.",
      when: (s) => s.lesson.errors > 12,
    },
  ],

  quiz: [
    {
      id: "cdn-origin-down",
      at: QUIZ_AT,
      question: "The origin just died. What do users see right now?",
      choices: [
        {
          id: "cached",
          label:
            "Mostly nothing — the edges keep serving cached copies until TTLs expire.",
        },
        {
          id: "errors",
          label: "Errors immediately — the origin is the only source of truth.",
        },
        {
          id: "slow",
          label: "Everything slows down while requests wait on the origin.",
        },
      ],
      correctChoiceId: "cached",
      explain:
        "A CDN is a shield made of copies. While an edge's copy is still inside its TTL it answers without asking the origin anything, so the instant the origin dies, nothing at all changes for the people it serves. Then watch: as each TTL lapses the PoP goes back for a fresh copy, finds nobody home, and only then do the errors start — region by region, not all at once. CDNs buy you time, not immortality; the TTL is the size of the loan.",
    },
  ],

  meters: [
    {
      metricKey: "hitRatio",
      label: "edge hit ratio",
      kind: "gauge",
      max: 100,
      unit: "%",
      dangerBelow: 30,
    },
    {
      metricKey: "originRps",
      label: "origin",
      kind: "counter",
      unit: "req/s",
      decimals: 1,
    },
    {
      metricKey: "slowest",
      label: "slowest region",
      kind: "counter",
      unit: "ms",
      // Roughly two edge round trips: past this, someone is talking to the
      // origin on every request.
      dangerAbove: 250,
    },
    {
      metricKey: "errors",
      label: "errors",
      kind: "counter",
      dangerAbove: 0,
    },
  ],

  packetStyles: {
    /** The long haul that skipped the edge — the colour of distance. */
    bypass: { color: "var(--color-glow-violet)" },
  },
};
