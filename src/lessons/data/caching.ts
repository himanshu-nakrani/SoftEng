import {
  advancePackets,
  approach,
  clamp01,
  drainQueue,
  emaEvent,
  shouldSpawn,
  spawnPacket,
} from "@/engine/sim-helpers";
import type { LessonSim } from "@/engine/types";

/**
 * Lesson 4 — Caching. A cache in front of a slow database.
 * Requests carry keys (zipf-ish 80/20 distribution); hits bounce straight
 * back green, misses trek on to the DB amber and populate the cache on the
 * way home. Learner tunes size and TTL against the hit-ratio dial.
 */

interface CacheEntry {
  key: number;
  expiresAt: number;
  lastUsed: number;
}

interface CachingState {
  entries: CacheEntry[];
  /** FIFO of keys waiting at the DB (doubles as the DB queue depth). */
  pendingKeys: number[];
  dbAcc: number;
  hitEma: number; // 0..1
  latencyEma: number; // ms
  hits: number;
  misses: number;
}

const KEYSPACE = 16;
const HIT_MS = 60;
const MISS_MS = 60 + 340;
/** The database is deliberately the slow part: 5 req/s. */
const DB_CAPACITY = 5;

export const cachingSim: LessonSim<CachingState> = {
  id: "caching",

  topology: {
    nodes: [
      { id: "client", kind: "client", label: "app", x: 130, y: 225 },
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
      key: "size",
      label: "cache size",
      kind: "slider",
      min: 2,
      max: 12,
      step: 1,
      unit: " keys",
      defaultValue: 4,
    },
    {
      key: "ttl",
      label: "ttl",
      kind: "slider",
      min: 2,
      max: 30,
      step: 2,
      unit: "s",
      defaultValue: 10,
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
    pendingKeys: [],
    dbAcc: 0,
    hitEma: 0.5,
    latencyEma: HIT_MS,
    hits: 0,
    misses: 0,
  }),

  step: (state, dt, params) => {
    const L = state.lesson;
    const size = Number(params.size);
    const ttl = Number(params.ttl);

    // 1. Reads arrive, each for a key. rng² biases toward hot low keys.
    const spawns = shouldSpawn(state, Number(params.rate), dt);
    for (let i = 0; i < spawns; i++) {
      const key = Math.floor(Math.pow(state.rng(), 2) * KEYSPACE);
      spawnPacket(state, "front", "request", { speed: 1.6, payload: { key } });
    }

    // 2. Deliveries.
    for (const p of advancePackets(state, dt)) {
      const key = Number(p.payload?.key ?? 0);
      if (p.edgeId === "front" && p.type === "request") {
        // At the cache: hit or miss?
        const entry = L.entries.find(
          (e) => e.key === key && e.expiresAt > state.t,
        );
        if (entry) {
          entry.lastUsed = state.t;
          L.hits += 1;
          L.hitEma = emaEvent(L.hitEma, true);
          L.latencyEma = emaEvent(L.latencyEma, HIT_MS, 0.8);
          spawnPacket(state, "front", "hit", { speed: 1.6, reverse: true });
        } else {
          L.misses += 1;
          L.hitEma = emaEvent(L.hitEma, false);
          L.latencyEma = emaEvent(L.latencyEma, MISS_MS, 0.8);
          spawnPacket(state, "back", "miss", { speed: 1.4, payload: { key } });
        }
      } else if (p.edgeId === "back" && p.type === "miss") {
        L.pendingKeys.push(key); // reached the DB; serviced below
      } else if (p.edgeId === "back" && p.type === "response") {
        // DB answer arrives back at the cache: populate (LRU evict).
        L.entries = L.entries.filter((e) => e.expiresAt > state.t);
        if (!L.entries.some((e) => e.key === key)) {
          if (L.entries.length >= size) {
            L.entries.sort((a, b) => a.lastUsed - b.lastUsed).shift();
          }
          L.entries.push({ key, expiresAt: state.t + ttl, lastUsed: state.t });
        }
        spawnPacket(state, "front", "response", { speed: 1.6, reverse: true });
      }
    }

    // 3. The DB is slow: capacity 5 req/s. The queue here is the pendingKeys
    //    FIFO itself, so drainQueue drives a depth mirror and each serve pops
    //    the matching key.
    const db = { depth: L.pendingKeys.length, acc: L.dbAcc };
    drainQueue(db, DB_CAPACITY, dt, () => {
      const servedKey = L.pendingKeys.shift()!;
      spawnPacket(state, "back", "response", {
        speed: 1.4,
        reverse: true,
        payload: { key: servedKey },
      });
    });
    L.dbAcc = db.acc;

    // 4. Readouts.
    L.entries = L.entries.filter((e) => e.expiresAt > state.t);
    state.nodes.cache.queueDepth = L.entries.length;
    state.nodes.cache.load = approach(
      state.nodes.cache.load,
      clamp01(L.entries.length / size),
      6,
      dt,
    );
    state.nodes.db.queueDepth = L.pendingKeys.length;
    state.nodes.db.load = approach(
      state.nodes.db.load,
      clamp01(L.pendingKeys.length / 10),
      6,
      dt,
    );
    state.metrics.hitRatio = L.hitEma * 100;
    state.metrics.latency = L.latencyEma;
    state.metrics.dbLoad = state.nodes.db.load * 100;
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
      kind: "counter",
      unit: "ms",
      dangerAbove: 320,
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
