import {
  advancePackets,
  approach,
  clamp01,
  shouldSpawn,
  spawnPacket,
} from "@/engine/sim-helpers";
import type { LessonSim } from "@/engine/types";

/**
 * B2 — CDN & Edge Caching. Two user regions, one distant origin, a PoP
 * near each region. Hits stay local (~80ms); misses trek to the origin
 * (~700ms). Kill a PoP and its region fails over to the origin: slower,
 * heavier on the origin — but alive.
 */

const REGIONS = ["eu", "us"] as const;
type Region = (typeof REGIONS)[number];

interface Entry {
  key: number;
  expiresAt: number;
}

interface CDNState {
  edgeCache: Record<Region, Entry[]>;
  /** Origin work queue: keys + which edge asked (for the return trip). */
  originQueue: {
    key: number;
    region: Region;
    noCache: boolean;
    createdAt: number;
  }[];
  originAcc: number;
  latSamples: Record<Region, number[]>;
  hits: number;
  misses: number;
  hitEma: number;
}

const KEYSPACE = 12;
const EDGE_MS = 40; // user ↔ PoP, one way
const ORIGIN_MS = 260; // PoP ↔ origin, one way
const EDGE_SPEED = 1 / (EDGE_MS / 1000);
const ORIGIN_SPEED = 1 / (ORIGIN_MS / 1000);
const ORIGIN_CAPACITY = 14; // req/s — headroom for one region's failover
const ORIGIN_MAX_QUEUE = 25; // beyond this the origin sheds load

export const cdnSim: LessonSim<CDNState> = {
  id: "cdn",

  topology: {
    nodes: [
      { id: "user-eu", kind: "client", label: "eu-users", x: 110, y: 120 },
      { id: "user-us", kind: "client", label: "us-users", x: 110, y: 330 },
      { id: "edge-eu", kind: "cache", label: "pop-eu", x: 360, y: 120, breakable: true },
      { id: "edge-us", kind: "cache", label: "pop-us", x: 360, y: 330, breakable: true },
      { id: "origin", kind: "server", label: "origin", x: 660, y: 225 },
    ],
    edges: [
      { id: "last-eu", from: "user-eu", to: "edge-eu" },
      { id: "last-us", from: "user-us", to: "edge-us" },
      { id: "haul-eu", from: "edge-eu", to: "origin", curve: -0.08 },
      { id: "haul-us", from: "edge-us", to: "origin", curve: 0.08 },
    ],
  },

  params: [
    {
      key: "rate",
      label: "traffic / region",
      kind: "slider",
      min: 2,
      max: 16,
      step: 1,
      unit: " req/s",
      defaultValue: 6,
    },
    {
      key: "size",
      label: "edge cache size",
      kind: "slider",
      min: 2,
      max: 10,
      step: 1,
      unit: " keys",
      defaultValue: 5,
    },
    {
      key: "ttl",
      label: "ttl",
      kind: "slider",
      min: 5,
      max: 60,
      step: 5,
      unit: "s",
      defaultValue: 20,
    },
  ],

  init: () => ({
    edgeCache: { eu: [], us: [] },
    originQueue: [],
    originAcc: 0,
    latSamples: { eu: [], us: [] },
    hits: 0,
    misses: 0,
    hitEma: 0.5,
  }),

  step: (state, dt, params) => {
    const L = state.lesson;
    const size = Number(params.size);
    const ttl = Number(params.ttl);

    // 1. Each region requests hot-skewed content.
    for (const region of REGIONS) {
      for (let i = 0; i < shouldSpawn(state, Number(params.rate), dt); i++) {
        const key = Math.floor(Math.pow(state.rng(), 2) * KEYSPACE);
        spawnPacket(state, `last-${region}`, "request", {
          speed: EDGE_SPEED,
          payload: { key, createdAt: state.t },
        });
      }
    }

    // 2. Deliveries.
    for (const p of advancePackets(state, dt)) {
      const region = p.edgeId.slice(-2) as Region;
      const key = Number(p.payload?.key ?? 0);
      const createdAt = Number(p.payload?.createdAt ?? state.t);

      if (p.edgeId.startsWith("last-") && p.type === "request") {
        // Arrived at the PoP.
        const dead = state.nodes[`edge-${region}`].health === "dead";
        if (dead) {
          // Failover: pass straight through to the origin, uncacheable.
          L.misses += 1;
          L.hitEma = approach(L.hitEma, 0, 0.15, 1);
          spawnPacket(state, `haul-${region}`, "miss", {
            speed: ORIGIN_SPEED,
            payload: { key, createdAt, noCache: true },
          });
          continue;
        }
        L.edgeCache[region] = L.edgeCache[region].filter(
          (e) => e.expiresAt > state.t,
        );
        const entry = L.edgeCache[region].find((e) => e.key === key);
        if (entry) {
          L.hits += 1;
          L.hitEma = approach(L.hitEma, 1, 0.15, 1);
          spawnPacket(state, p.edgeId, "hit", {
            speed: EDGE_SPEED,
            reverse: true,
            payload: { createdAt },
          });
        } else {
          L.misses += 1;
          L.hitEma = approach(L.hitEma, 0, 0.15, 1);
          spawnPacket(state, `haul-${region}`, "miss", {
            speed: ORIGIN_SPEED,
            payload: { key, createdAt, noCache: false },
          });
        }
      } else if (p.edgeId.startsWith("haul-") && p.type === "miss") {
        // Reached the origin — which sheds load past its queue bound.
        if (L.originQueue.length >= ORIGIN_MAX_QUEUE) {
          spawnPacket(state, p.edgeId, "drop", {
            speed: ORIGIN_SPEED * 1.3,
            reverse: true,
            size: 3,
          });
        } else {
          L.originQueue.push({
            key,
            region,
            noCache: p.payload?.noCache === true,
            createdAt,
          });
        }
      } else if (p.edgeId.startsWith("haul-") && p.type === "response") {
        // Origin answer back at the PoP: cache (unless failover) + forward.
        if (p.payload?.noCache !== true) {
          const cache = L.edgeCache[region];
          if (!cache.some((e) => e.key === key)) {
            if (cache.length >= size) cache.shift();
            cache.push({ key, expiresAt: state.t + ttl });
          }
        }
        spawnPacket(state, `last-${region}`, "response", {
          speed: EDGE_SPEED,
          reverse: true,
          payload: { createdAt },
        });
      } else if (p.edgeId.startsWith("last-") && (p.type === "hit" || p.type === "response")) {
        // Back at the user: measure end-to-end.
        const samples = L.latSamples[region];
        samples.push((state.t - createdAt) * 1000);
        if (samples.length > 20) samples.shift();
      }
    }

    // 3. Origin serves its queue.
    L.originAcc += ORIGIN_CAPACITY * dt;
    while (L.originAcc >= 1 && L.originQueue.length > 0) {
      L.originAcc -= 1;
      const job = L.originQueue.shift()!;
      spawnPacket(state, `haul-${job.region}`, "response", {
        speed: ORIGIN_SPEED,
        reverse: true,
        payload: {
          key: job.key,
          noCache: job.noCache,
          createdAt: job.createdAt,
        },
      });
    }
    if (L.originQueue.length === 0) L.originAcc = Math.min(L.originAcc, 1);

    // 4. Readouts.
    for (const region of REGIONS) {
      state.nodes[`edge-${region}`].queueDepth =
        L.edgeCache[region].length;
      state.nodes[`edge-${region}`].load = approach(
        state.nodes[`edge-${region}`].load,
        clamp01(L.edgeCache[region].length / size),
        6,
        dt,
      );
    }
    state.nodes.origin.queueDepth = L.originQueue.length;
    state.nodes.origin.load = approach(
      state.nodes.origin.load,
      clamp01(L.originQueue.length / ORIGIN_MAX_QUEUE),
      6,
      dt,
    );
    const avg = (xs: number[]) =>
      xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 80;
    state.metrics.latEu = avg(L.latSamples.eu);
    state.metrics.latUs = avg(L.latSamples.us);
    state.metrics.hitRatio = L.hitEma * 100;
    state.metrics.originLoad = state.nodes.origin.load * 100;
  },

  timeline: [
    {
      at: 2,
      caption:
        "Two regions, one origin an ocean away. The PoPs are small caches parked next to users.",
    },
    {
      at: 8,
      caption:
        "Green = served at the edge (~80ms). Amber = the long haul to origin (~700ms).",
    },
    {
      at: 15,
      caption:
        "☠ Kill pop-eu and watch EU'S P50 — slower, heavier on origin, but alive.",
    },
  ],

  quiz: [
    {
      id: "pop-death",
      at: 12,
      question:
        "The EU PoP is about to die. What happens to EU users?",
      choices: [
        {
          id: "degrade",
          label: "Latency jumps to origin levels — but requests keep succeeding",
        },
        { id: "outage", label: "EU goes down until the PoP returns" },
        { id: "magic", label: "Nothing — the US PoP absorbs them invisibly" },
      ],
      correctChoiceId: "degrade",
      explain:
        "CDNs fail toward the origin: a dead PoP means the region loses its shortcut, not its service. The costs are real — every EU request now pays the full round trip, and the origin absorbs load the edge used to shield — but degradation beats outage. (Real CDNs also reroute to neighboring PoPs via anycast.)",
    },
  ],

  meters: [
    {
      metricKey: "latEu",
      label: "p50 · eu",
      kind: "counter",
      unit: "ms",
      dangerAbove: 500,
    },
    {
      metricKey: "latUs",
      label: "p50 · us",
      kind: "counter",
      unit: "ms",
      dangerAbove: 500,
    },
    {
      metricKey: "hitRatio",
      label: "edge hit ratio",
      kind: "gauge",
      max: 100,
      unit: "%",
      dangerBelow: 30,
    },
    {
      metricKey: "originLoad",
      label: "origin load",
      kind: "bar",
      max: 100,
      dangerAbove: 80,
    },
  ],
};
