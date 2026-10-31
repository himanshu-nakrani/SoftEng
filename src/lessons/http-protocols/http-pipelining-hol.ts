import {
  advancePackets,
  emaEvent,
  spawnPacket,
} from "@/engine/sim-helpers";
import type { LessonSim } from "@/engine/types";

/**
 * HTTP/1.1 Pipelining & Head-of-Line Blocking — archetype A (the packet engine).
 *
 * HTTP/1.1 pipelining allowed a client to send multiple requests back-to-back
 * over a single TCP connection without waiting for each response. In theory,
 * this saves round trips by filling the pipe.
 *
 * In practice, RFC 2616 §8.1.2.2 mandated that responses MUST be returned in the
 * exact order the requests were received (FIFO). If request 1 is a slow dynamic
 * database query and requests 2, 3, 4 are tiny static assets (CSS, JS, icons),
 * the server can finish computing requests 2, 3, and 4 in milliseconds — but it
 * CANNOT send them down the wire until response 1 has been transmitted.
 *
 * This is APPLICATION HEAD-OF-LINE (HOL) BLOCKING: fast resources sit idly buffered
 * on the server, waiting for the bottleneck at the front of the line.
 */

const CLIENT = "client";
const SERVER = "server";

const MS_PER_SEC = 1000;
const ONE_WAY = 0.2;
const WIRE_SPEED = 1 / ONE_WAY;

const FAST_SERVE_TIME = 0.08;
const SLOW_SERVE_TIME = 0.9;
const BATCH_SIZE = 4;
const BATCH_PERIOD = 5.0;
const LAT_EMA_RATE = 0.4;

interface ResourceReq extends Record<string, unknown> {
  id: number;
  seq: number;
  connId: number;
  slow: boolean;
  enqueuedAt: number;
  arrivedServerAt: number;
  computedAt: number;
  sentResponseAt: number;
}

interface ConnLane {
  id: number;
  edgeId: string;
  busySending: boolean;
  expectedSeq: number;
  activeProcessing: ResourceReq | null;
  processingUntil: number;
  holdBuffer: ResourceReq[];
}

interface HttpPipeliningHolState {
  queue: ResourceReq[];
  lanes: ConnLane[];
  nextSeq: number;
  batchRemaining: number;
  batchStartedAt: number;
  nextBatchAt: number;
  pageMs: number;
  lastPageMs: number;
  holDelayMs: number;
  completed: number;
  laneCount: number;
}

function makeLanes(count: number): ConnLane[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    edgeId: i === 0 ? "conn-0" : "conn-1",
    busySending: false,
    expectedSeq: 1,
    activeProcessing: null,
    processingUntil: 0,
    holdBuffer: [],
  }));
}

export const httpPipeliningHolSim: LessonSim<HttpPipeliningHolState> = {
  id: "http-pipelining-hol",

  topology: {
    nodes: [
      { id: CLIENT, kind: "client", label: "browser", x: 160, y: 225 },
      { id: SERVER, kind: "server", label: "origin-server", x: 640, y: 225 },
    ],
    edges: [
      { id: "conn-0", from: CLIENT, to: SERVER, curve: -0.18 },
      { id: "conn-1", from: CLIENT, to: SERVER, curve: 0.18 },
    ],
  },

  params: [
    {
      key: "pipelining",
      label: "pipelining",
      kind: "toggle",
      defaultValue: true,
    },
    {
      key: "slowFirst",
      label: "slow first request",
      kind: "toggle",
      defaultValue: true,
    },
    {
      key: "connections",
      label: "connections",
      kind: "slider",
      min: 1,
      max: 2,
      step: 1,
      defaultValue: 1,
    },
  ],

  init: () => ({
    queue: [],
    lanes: makeLanes(1),
    nextSeq: 1,
    batchRemaining: 0,
    batchStartedAt: 0,
    nextBatchAt: 0.5,
    pageMs: 0,
    lastPageMs: 0,
    holDelayMs: 0,
    completed: 0,
    laneCount: 1,
  }),

  step: (state, dt, params) => {
    const L = state.lesson;
    const pipelining = params.pipelining === true;
    const slowFirst = params.slowFirst === true;
    const connCount = Math.round(Number(params.connections));

    // Resize lanes if connections slider changed
    if (connCount !== L.laneCount) {
      if (connCount > L.lanes.length) {
        L.lanes.push({
          id: 1,
          edgeId: "conn-1",
          busySending: false,
          expectedSeq: 1,
          activeProcessing: null,
          processingUntil: 0,
          holdBuffer: [],
        });
      }
      L.laneCount = connCount;
    }

    // 1. Trigger new page load batch
    if (state.t >= L.nextBatchAt && L.batchRemaining === 0) {
      L.batchStartedAt = state.t;
      L.batchRemaining = BATCH_SIZE;
      L.nextBatchAt = state.t + BATCH_PERIOD;

      // Reset expected seq per lane for this batch
      for (const lane of L.lanes) {
        lane.expectedSeq = 1;
        lane.holdBuffer = [];
        lane.activeProcessing = null;
      }

      const laneCounters = Array(connCount).fill(1);
      for (let i = 0; i < BATCH_SIZE; i++) {
        const slow = slowFirst && i === 0;
        const connId = i % connCount;
        const seq = laneCounters[connId]++;
        L.queue.push({
          id: L.nextSeq++,
          seq,
          connId,
          slow,
          enqueuedAt: state.t,
          arrivedServerAt: 0,
          computedAt: 0,
          sentResponseAt: 0,
        });
      }
    }

    // 2. Dispatch requests from queue to connections
    for (let c = 0; c < connCount; c++) {
      const lane = L.lanes[c];
      if (!lane) continue;

      // Check how many requests are in flight on this connection
      const inFlightOnLane = state.packets.filter(
        (p) => p.edgeId === lane.edgeId && p.type === "request",
      ).length;

      // With pipelining: send all available queued requests for this lane.
      // Without pipelining (stop-and-wait): only 1 request at a time on the lane.
      const canSend = pipelining || (inFlightOnLane === 0 && !lane.busySending && lane.activeProcessing === null);

      if (canSend) {
        const idx = L.queue.findIndex((r) => r.connId === lane.id);
        if (idx !== -1) {
          const req = L.queue.splice(idx, 1)[0];
          spawnPacket(state, lane.edgeId, "request", {
            speed: WIRE_SPEED,
            payload: req,
          });
        }
      }
    }

    // 3. Advance packets & handle arrivals at server and client
    for (const p of advancePackets(state, dt)) {
      const req = p.payload as ResourceReq;
      if (!req) continue;

      if (p.type === "request") {
        // Request reached server -> enter processing on its lane
        const lane = L.lanes.find((l) => l.id === req.connId);
        if (lane) {
          req.arrivedServerAt = state.t;
          lane.holdBuffer.push(req);
        }
      } else if (p.type === "response") {
        // Response reached client
        L.completed += 1;
        L.batchRemaining = Math.max(0, L.batchRemaining - 1);

        if (L.batchRemaining === 0) {
          const elapsedMs = Math.round((state.t - L.batchStartedAt) * MS_PER_SEC);
          L.lastPageMs = elapsedMs;
          L.pageMs = L.pageMs === 0 ? elapsedMs : Math.round(emaEvent(L.pageMs, elapsedMs, LAT_EMA_RATE));
        }
      }
    }

    // 4. Server processing and FIFO response draining
    for (let c = 0; c < connCount; c++) {
      const lane = L.lanes[c];
      if (!lane) continue;

      // Mark any in-progress requests whose server compute is finished
      for (const req of lane.holdBuffer) {
        if (req.computedAt === 0 && state.t >= req.arrivedServerAt + (req.slow ? SLOW_SERVE_TIME : FAST_SERVE_TIME)) {
          req.computedAt = state.t;
        }
      }

      // Check if the expected next sequence is ready to send down the wire
      let drained = true;
      while (drained) {
        drained = false;
        const nextIdx = lane.holdBuffer.findIndex(
          (r) => r.computedAt > 0 && r.seq === lane.expectedSeq,
        );
        if (nextIdx !== -1) {
          const ready = lane.holdBuffer.splice(nextIdx, 1)[0];
          ready.sentResponseAt = state.t;
          // Time spent ready in buffer waiting for earlier sequences to clear
          const waitMs = Math.round((state.t - ready.computedAt) * MS_PER_SEC);
          if (waitMs > 0) {
            L.holDelayMs = L.holDelayMs === 0 ? waitMs : Math.round(emaEvent(L.holDelayMs, waitMs, LAT_EMA_RATE));
          }
          spawnPacket(state, lane.edgeId, "response", {
            speed: WIRE_SPEED,
            reverse: true,
            payload: ready,
          });
          lane.expectedSeq += 1;
          drained = true;
        }
      }

      // Track ongoing HOL delay for completed responses stuck waiting
      for (const trapped of lane.holdBuffer) {
        if (trapped.computedAt > 0) {
          const currentDelay = Math.round((state.t - trapped.computedAt) * MS_PER_SEC);
          L.holDelayMs = Math.max(L.holDelayMs, currentDelay);
        }
      }
    }

    // Publish metrics
    state.metrics.pageMs = L.pageMs > 0 ? L.pageMs : L.lastPageMs;
    state.metrics.holDelayMs = L.holDelayMs;
    state.metrics.inFlight = state.packets.length;
    state.metrics.completed = L.completed;
  },

  meters: [
    { metricKey: "pageMs", label: "page load time", kind: "gauge", max: 3000, unit: "ms" },
    { metricKey: "holDelayMs", label: "HOL delay", kind: "gauge", max: 1500, unit: "ms" },
    { metricKey: "inFlight", label: "in flight", kind: "counter" },
    { metricKey: "completed", label: "completed", kind: "counter" },
  ],
};
