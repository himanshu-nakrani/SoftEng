import {
  advancePackets,
  emaEvent,
  spawnPacket,
} from "@/engine/sim-helpers";
import type { LessonSim } from "@/engine/types";

/**
 * HTTP Caching & Revalidation — archetype A (the packet engine).
 *
 * The cheapest, lowest-latency network request is the one that never leaves
 * the user's machine. HTTP caching coordinates three tiers:
 *   1. The browser local cache (in-memory or disk, 0ms latency)
 *   2. The CDN edge cache (geographically close, ~100ms round trip)
 *   3. The origin server (authoritative database, ~700ms round trip)
 *
 * Cache-Control headers govern freshness:
 * - `no-cache`: Forces validation every time; every request traverses to the origin.
 * - `max-age=N`: The browser serves from local memory with 0ms latency for N seconds.
 * - `stale-while-revalidate`: When the lease expires, the browser serves the stale
 *   cached asset immediately to the user (0ms perceived latency), while triggering
 *   an asynchronous background refresh to the origin.
 */

const CLIENT = "client";
const CDN = "cdn";
const ORIGIN = "origin";

const WIRE_CLIENT_CDN = "client-cdn";
const WIRE_CDN_ORIGIN = "cdn-origin";

const MS_PER_SEC = 1000;
const CLIENT_CDN_SPEED = 1 / 0.12; // 120ms one way
const CDN_ORIGIN_SPEED = 1 / 0.22; // 220ms one way

const REQUEST_INTERVAL = 2.0;
const LAT_EMA_RATE = 0.3;

interface CacheReq extends Record<string, unknown> {
  id: number;
  bornAt: number;
  isBackgroundRevalidate?: boolean;
}

interface HttpCachingState {
  nextReqId: number;
  nextReqAt: number;
  browserFreshUntil: number;
  cdnFreshUntil: number;
  browserHits: number;
  cdnHits: number;
  originHits: number;
  totalRequests: number;
  avgLatencyMs: number;
  lastLatencyMs: number;
}

export const httpCachingSim: LessonSim<HttpCachingState> = {
  id: "http-caching",

  topology: {
    nodes: [
      { id: CLIENT, kind: "client", label: "browser", x: 150, y: 225 },
      { id: CDN, kind: "server", label: "cdn-edge", x: 400, y: 225 },
      { id: ORIGIN, kind: "server", label: "origin-db", x: 650, y: 225 },
    ],
    edges: [
      { id: WIRE_CLIENT_CDN, from: CLIENT, to: CDN },
      { id: WIRE_CDN_ORIGIN, from: CDN, to: ORIGIN },
    ],
  },

  params: [
    {
      key: "strategy",
      label: "cache strategy",
      kind: "select",
      options: [
        { label: "max-age (fresh cache)", value: "max-age" },
        { label: "no-cache (always validate)", value: "no-cache" },
        { label: "stale-while-revalidate", value: "stale-while-revalidate" },
      ],
      defaultValue: "max-age",
    },
    {
      key: "ttl",
      label: "max-age TTL",
      kind: "slider",
      min: 2,
      max: 8,
      step: 1,
      unit: "s",
      defaultValue: 4,
    },
  ],

  init: () => ({
    nextReqId: 1,
    nextReqAt: 0.5,
    browserFreshUntil: 0,
    cdnFreshUntil: 0,
    browserHits: 0,
    cdnHits: 0,
    originHits: 0,
    totalRequests: 0,
    avgLatencyMs: 0,
    lastLatencyMs: 0,
  }),

  step: (state, dt, params) => {
    const L = state.lesson;
    const strategy = String(params.strategy ?? "max-age");
    const ttl = Number(params.ttl);

    // 1. Client issues request on interval
    if (state.t >= L.nextReqAt) {
      L.nextReqAt = state.t + REQUEST_INTERVAL;
      L.totalRequests += 1;
      const reqId = L.nextReqId++;

      if (strategy === "no-cache") {
        // No caching: forward directly to CDN
        spawnPacket(state, WIRE_CLIENT_CDN, "request", {
          speed: CLIENT_CDN_SPEED,
          payload: { id: reqId, bornAt: state.t },
        });
      } else if (strategy === "max-age") {
        if (state.t < L.browserFreshUntil) {
          // Local browser cache HIT! 0ms latency, no packets on wire
          L.browserHits += 1;
          const lat = 0;
          L.lastLatencyMs = lat;
          L.avgLatencyMs = L.avgLatencyMs === 0 ? lat : Math.round(emaEvent(L.avgLatencyMs, lat, LAT_EMA_RATE));
        } else {
          // Browser cache MISS: send to CDN
          spawnPacket(state, WIRE_CLIENT_CDN, "request", {
            speed: CLIENT_CDN_SPEED,
            payload: { id: reqId, bornAt: state.t },
          });
        }
      } else if (strategy === "stale-while-revalidate") {
        if (L.browserFreshUntil > 0) {
          // Return stale cache immediately to user (0ms perceived latency!)
          L.browserHits += 1;
          const lat = 0;
          L.lastLatencyMs = lat;
          L.avgLatencyMs = L.avgLatencyMs === 0 ? lat : Math.round(emaEvent(L.avgLatencyMs, lat, LAT_EMA_RATE));

          // If stale, spawn background revalidation to CDN/Origin
          if (state.t >= L.browserFreshUntil) {
            spawnPacket(state, WIRE_CLIENT_CDN, "request", {
              speed: CLIENT_CDN_SPEED,
              payload: { id: reqId, bornAt: state.t, isBackgroundRevalidate: true },
            });
          }
        } else {
          // Cold initial fetch
          spawnPacket(state, WIRE_CLIENT_CDN, "request", {
            speed: CLIENT_CDN_SPEED,
            payload: { id: reqId, bornAt: state.t },
          });
        }
      }
    }

    // 2. Advance packets & process arrivals
    for (const p of advancePackets(state, dt)) {
      const req = p.payload as CacheReq;
      if (!req) continue;

      if (p.edgeId === WIRE_CLIENT_CDN && p.type === "request") {
        // Request reached CDN
        if (strategy !== "no-cache" && state.t < L.cdnFreshUntil) {
          // CDN cache HIT: answer directly back to browser
          L.cdnHits += 1;
          spawnPacket(state, WIRE_CLIENT_CDN, "response", {
            speed: CLIENT_CDN_SPEED,
            reverse: true,
            payload: req,
          });
        } else {
          // CDN cache MISS: forward to origin
          spawnPacket(state, WIRE_CDN_ORIGIN, "request", {
            speed: CDN_ORIGIN_SPEED,
            payload: req,
          });
        }
      } else if (p.edgeId === WIRE_CDN_ORIGIN && p.type === "request") {
        // Request reached Origin database -> generate response and populate CDN cache
        L.originHits += 1;
        if (strategy !== "no-cache") {
          L.cdnFreshUntil = state.t + ttl;
        }
        spawnPacket(state, WIRE_CDN_ORIGIN, "response", {
          speed: CDN_ORIGIN_SPEED,
          reverse: true,
          payload: req,
        });
      } else if (p.edgeId === WIRE_CDN_ORIGIN && p.type === "response") {
        // Response returned from origin to CDN -> forward to browser
        spawnPacket(state, WIRE_CLIENT_CDN, "response", {
          speed: CLIENT_CDN_SPEED,
          reverse: true,
          payload: req,
        });
      } else if (p.edgeId === WIRE_CLIENT_CDN && p.type === "response") {
        // Response reached browser -> populate browser cache and record user latency
        if (strategy !== "no-cache") {
          L.browserFreshUntil = state.t + ttl;
        }

        if (!req.isBackgroundRevalidate) {
          const lat = Math.round((state.t - req.bornAt) * MS_PER_SEC);
          L.lastLatencyMs = lat;
          L.avgLatencyMs = L.avgLatencyMs === 0 ? lat : Math.round(emaEvent(L.avgLatencyMs, lat, LAT_EMA_RATE));
        }
      }
    }

    // Metrics
    const hitRate = L.totalRequests > 0 ? Math.round((L.browserHits / L.totalRequests) * 100) : 0;
    state.metrics.hitRate = hitRate;
    state.metrics.avgLatencyMs = L.avgLatencyMs;
    state.metrics.originHits = L.originHits;
    state.metrics.served = L.totalRequests;
  },

  meters: [
    { metricKey: "hitRate", label: "browser cache hit rate", kind: "gauge", max: 100, unit: "%" },
    { metricKey: "avgLatencyMs", label: "average latency", kind: "gauge", max: 1000, unit: "ms" },
    { metricKey: "originHits", label: "origin requests", kind: "counter" },
    { metricKey: "served", label: "requests served", kind: "counter" },
  ],
};
