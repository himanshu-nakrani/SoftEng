import {
  advancePackets,
  emaEvent,
  spawnPacket,
} from "@/engine/sim-helpers";
import type { LessonSim } from "@/engine/types";

/**
 * Conditional Requests & ETags — archetype A (the packet engine).
 *
 * When an HTTP cache's `max-age` expires, the cached representation is not
 * necessarily obsolete — the underlying document on the server might be completely
 * unchanged. Naively re-downloading the entire multi-megabyte resource on every
 * expiration is a massive waste of bandwidth and wire time.
 *
 * Conditional requests solve this with HTTP validators:
 * - `ETag` (Entity Tag): An opaque cryptographic hash of the content (e.g. `"3a8f2"`).
 * - `If-None-Match`: The client sends its cached ETag in the request header.
 *
 * If the server's current resource hash matches `If-None-Match`:
 * - The server answers with `304 Not Modified`.
 * - The response carries headers only (roughly 300 bytes), with NO response body.
 * - The client refreshes its local cache lease without re-downloading a single byte of data.
 * - Bandwidth consumption on the wire drops by >99% compared to a full 200 OK transfer.
 */

const CLIENT = "client";
const SERVER = "server";
const WIRE = "wire";

const MS_PER_SEC = 1000;
const ONE_WAY = 0.15;
const WIRE_SPEED = 1 / ONE_WAY;

const REQUEST_INTERVAL = 2.0;
const LAT_EMA_RATE = 0.4;
const FULL_PAYLOAD_KB = 50.0;
const HEADER_ONLY_KB = 0.3;

interface ValidationReq extends Record<string, unknown> {
  id: number;
  bornAt: number;
  sentEtag: string | null;
}

interface ValidationResp extends Record<string, unknown> {
  id: number;
  bornAt: number;
  statusCode: 200 | 304;
  payloadKb: number;
  etag: string;
}

interface ConditionalRequestsState {
  nextReqId: number;
  nextReqAt: number;
  cachedEtag: string | null;
  bytesTransferredKb: number;
  reqs200: number;
  reqs304: number;
  totalRequests: number;
  avgTransferMs: number;
  lastTransferMs: number;
}

export const conditionalRequestsSim: LessonSim<ConditionalRequestsState> = {
  id: "conditional-requests",

  topology: {
    nodes: [
      { id: CLIENT, kind: "client", label: "browser", x: 180, y: 225 },
      { id: SERVER, kind: "server", label: "origin-server", x: 620, y: 225 },
    ],
    edges: [{ id: WIRE, from: CLIENT, to: SERVER }],
  },

  params: [
    {
      key: "useEtags",
      label: "conditional If-None-Match",
      kind: "toggle",
      defaultValue: true,
    },
    {
      key: "resourceModified",
      label: "origin resource changed",
      kind: "toggle",
      defaultValue: false,
    },
  ],

  init: () => ({
    nextReqId: 1,
    nextReqAt: 0.5,
    cachedEtag: null,
    bytesTransferredKb: 0,
    reqs200: 0,
    reqs304: 0,
    totalRequests: 0,
    avgTransferMs: 0,
    lastTransferMs: 0,
  }),

  step: (state, dt, params) => {
    const L = state.lesson;
    const useEtags = params.useEtags === true;
    const resourceModified = params.resourceModified === true;
    const currentOriginEtag = resourceModified ? '"etag-v2"' : '"etag-v1"';

    // 1. Client issues periodic validation requests
    if (state.t >= L.nextReqAt) {
      L.nextReqAt = state.t + REQUEST_INTERVAL;
      L.totalRequests += 1;
      const reqId = L.nextReqId++;

      // Send request packet with cached ETag if enabled
      const sentEtag = useEtags ? L.cachedEtag : null;
      spawnPacket(state, WIRE, "request", {
        speed: WIRE_SPEED,
        payload: { id: reqId, bornAt: state.t, sentEtag },
      });
    }

    // 2. Advance packets & process arrivals
    for (const p of advancePackets(state, dt)) {
      if (p.type === "request") {
        const req = p.payload as ValidationReq;
        if (!req) continue;

        // Server evaluates conditional header
        const isMatch = req.sentEtag !== null && req.sentEtag === currentOriginEtag;
        const statusCode: 200 | 304 = isMatch ? 304 : 200;
        const payloadKb = isMatch ? HEADER_ONLY_KB : FULL_PAYLOAD_KB;

        L.bytesTransferredKb += payloadKb;
        if (statusCode === 304) {
          L.reqs304 += 1;
        } else {
          L.reqs200 += 1;
        }

        // Return response packet (speed scales slightly with payload size)
        const respSpeed = isMatch ? WIRE_SPEED : WIRE_SPEED * 0.6;
        spawnPacket(state, WIRE, "response", {
          speed: respSpeed,
          reverse: true,
          payload: {
            id: req.id,
            bornAt: req.bornAt,
            statusCode,
            payloadKb,
            etag: currentOriginEtag,
          },
        });
      } else if (p.type === "response") {
        const resp = p.payload as ValidationResp;
        if (!resp) continue;

        // Browser updates its cached ETag
        L.cachedEtag = resp.etag;

        const lat = Math.round((state.t - resp.bornAt) * MS_PER_SEC);
        L.lastTransferMs = lat;
        L.avgTransferMs = L.avgTransferMs === 0 ? lat : Math.round(emaEvent(L.avgTransferMs, lat, LAT_EMA_RATE));
      }
    }

    // Metrics
    const status304Ratio = L.totalRequests > 0 ? Math.round((L.reqs304 / L.totalRequests) * 100) : 0;
    const naiveBytes = L.totalRequests * FULL_PAYLOAD_KB;
    const savedPct = naiveBytes > 0 ? Math.round(((naiveBytes - L.bytesTransferredKb) / naiveBytes) * 100) : 0;

    state.metrics.bytesTransferredKb = Math.round(L.bytesTransferredKb * 10) / 10;
    state.metrics.status304Ratio = status304Ratio;
    state.metrics.avgTransferMs = L.avgTransferMs;
    state.metrics.bandwidthSavedPct = Math.max(0, savedPct);
  },

  meters: [
    { metricKey: "bytesTransferredKb", label: "data transferred", kind: "gauge", max: 400, unit: "KB" },
    { metricKey: "status304Ratio", label: "304 Not Modified rate", kind: "gauge", max: 100, unit: "%" },
    { metricKey: "avgTransferMs", label: "average transfer time", kind: "gauge", max: 1000, unit: "ms" },
    { metricKey: "bandwidthSavedPct", label: "bandwidth saved", kind: "gauge", max: 100, unit: "%" },
  ],
};
