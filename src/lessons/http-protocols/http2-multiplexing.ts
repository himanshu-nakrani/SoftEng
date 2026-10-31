import {
  advancePackets,
  emaEvent,
  spawnPacket,
} from "@/engine/sim-helpers";
import type { LessonSim } from "@/engine/types";

/**
 * HTTP/2 Multiplexing & Framing — archetype A (the packet engine).
 *
 * HTTP/2 introduced a binary framing layer between the application and TCP.
 * Instead of whole HTTP messages monopolizing a TCP connection sequentially,
 * requests and responses are broken into small binary frames (HEADERS, DATA)
 * tagged with an odd integer stream ID (1, 3, 5...).
 *
 * This eliminates application-layer head-of-line blocking: frames from different
 * streams interleave concurrently over ONE shared TCP connection. A small, fast
 * API call (Stream 5) finishes in a couple of round trips even while a large hero
 * image (Stream 3) is still streaming.
 *
 * THE ACHILLES' HEEL: TRANSPORT-LEVEL HOL BLOCKING.
 * While HTTP/2 solves application HOL blocking, it rides on a single TCP connection.
 * TCP knows nothing about HTTP/2 streams — to TCP, the connection is an immutable,
 * strictly in-order byte stream. If a single IP packet carrying one frame drops,
 * TCP's receive buffer halts delivery of ALL subsequent frames to the application
 * until the lost segment is retransmitted. Under packet loss, HTTP/2's single socket
 * makes the entire page stall together.
 */

const CLIENT = "client";
const SERVER = "server";
const WIRE = "wire";

const MS_PER_SEC = 1000;
const ONE_WAY = 0.2;
const WIRE_SPEED = 1 / ONE_WAY;

const BATCH_PERIOD = 5.0;
const LAT_EMA_RATE = 0.4;
const TCP_RTO_SEC = 0.6; // Retransmit timeout on loss

interface StreamFrame extends Record<string, unknown> {
  streamId: number;
  frameIndex: number;
  totalFrames: number;
  label: string;
  isRetransmit?: boolean;
}

interface Http2MultiplexingState {
  framesToSend: StreamFrame[];
  streamsRemaining: number;
  batchStartedAt: number;
  nextBatchAt: number;
  pageMs: number;
  lastPageMs: number;
  tcpStallMs: number;
  framesDelivered: number;
  activeStreams: number;
  tcpStalledUntil: number;
  pendingRetransmit: StreamFrame | null;
}

export const http2MultiplexingSim: LessonSim<Http2MultiplexingState> = {
  id: "http2-multiplexing",

  topology: {
    nodes: [
      { id: CLIENT, kind: "client", label: "browser", x: 160, y: 225 },
      { id: SERVER, kind: "server", label: "h2-server", x: 640, y: 225 },
    ],
    edges: [{ id: WIRE, from: CLIENT, to: SERVER }],
  },

  params: [
    {
      key: "multiplexing",
      label: "multiplexing",
      kind: "toggle",
      defaultValue: true,
    },
    {
      key: "lossRate",
      label: "packet loss",
      kind: "slider",
      min: 0,
      max: 15,
      step: 1,
      unit: "%",
      defaultValue: 0,
    },
  ],

  init: () => ({
    framesToSend: [],
    streamsRemaining: 0,
    batchStartedAt: 0,
    nextBatchAt: 0.5,
    pageMs: 0,
    lastPageMs: 0,
    tcpStallMs: 0,
    framesDelivered: 0,
    activeStreams: 0,
    tcpStalledUntil: 0,
    pendingRetransmit: null,
  }),

  step: (state, dt, params) => {
    const L = state.lesson;
    const multiplexing = params.multiplexing === true;
    const lossRate = Number(params.lossRate);

    // 1. Initiate page batch: 3 streams
    // Stream 1: CSS (3 frames)
    // Stream 3: Image (5 frames)
    // Stream 5: API JSON (2 frames)
    if (state.t >= L.nextBatchAt && L.streamsRemaining === 0) {
      L.batchStartedAt = state.t;
      L.streamsRemaining = 3;
      L.activeStreams = 3;
      L.nextBatchAt = state.t + BATCH_PERIOD;

      const s1: StreamFrame[] = Array.from({ length: 3 }, (_, i) => ({
        streamId: 1,
        frameIndex: i + 1,
        totalFrames: 3,
        label: `S1:${i + 1}`,
      }));
      const s3: StreamFrame[] = Array.from({ length: 5 }, (_, i) => ({
        streamId: 3,
        frameIndex: i + 1,
        totalFrames: 5,
        label: `S3:${i + 1}`,
      }));
      const s5: StreamFrame[] = Array.from({ length: 2 }, (_, i) => ({
        streamId: 5,
        frameIndex: i + 1,
        totalFrames: 2,
        label: `S5:${i + 1}`,
      }));

      if (multiplexing) {
        // Interleave frames across streams: S1, S3, S5, S1, S3, S5, S1, S3, S3, S3
        L.framesToSend = [];
        const maxLen = Math.max(s1.length, s3.length, s5.length);
        for (let i = 0; i < maxLen; i++) {
          if (i < s1.length) L.framesToSend.push(s1[i]);
          if (i < s3.length) L.framesToSend.push(s3[i]);
          if (i < s5.length) L.framesToSend.push(s5[i]);
        }
      } else {
        // Sequential: all S1, then all S3, then all S5
        L.framesToSend = [...s1, ...s3, ...s5];
      }
    }

    // 2. Handle TCP stall resolution and retransmission
    if (L.tcpStalledUntil > 0) {
      if (state.t >= L.tcpStalledUntil) {
        // Retransmit arrived! TCP unblocks
        if (L.pendingRetransmit) {
          spawnPacket(state, WIRE, "response", {
            speed: WIRE_SPEED,
            reverse: true,
            payload: L.pendingRetransmit,
          });
          L.pendingRetransmit = null;
        }
        L.tcpStalledUntil = 0;
      }
    }

    // 3. Dispatch frames onto the wire
    // If TCP is stalled, wire cannot accept new data until loss is repaired
    if (L.tcpStalledUntil === 0 && L.framesToSend.length > 0) {
      // In flight frame throttle: at most 2 frames on wire concurrently
      const inFlight = state.packets.filter((p) => p.edgeId === WIRE).length;
      if (inFlight < 2) {
        const frame = L.framesToSend.shift()!;

        // Check packet drop under lossRate
        const drop = lossRate > 0 && state.rng() * 100 < lossRate;
        if (drop && L.tcpStalledUntil === 0) {
          // Frame dropped! Trigger TCP stall
          L.tcpStalledUntil = state.t + TCP_RTO_SEC;
          L.pendingRetransmit = { ...frame, isRetransmit: true };
          const stallMs = Math.round(TCP_RTO_SEC * MS_PER_SEC);
          L.tcpStallMs = L.tcpStallMs === 0 ? stallMs : Math.round(emaEvent(L.tcpStallMs, stallMs, LAT_EMA_RATE));
        } else {
          spawnPacket(state, WIRE, "response", {
            speed: WIRE_SPEED,
            reverse: true,
            payload: frame,
          });
        }
      }
    }

    // 4. Advance packets and handle arrivals
    for (const p of advancePackets(state, dt)) {
      if (p.type === "response") {
        const frame = p.payload as StreamFrame;
        L.framesDelivered += 1;

        // Check if this stream finished
        if (frame && frame.frameIndex === frame.totalFrames) {
          L.activeStreams = Math.max(0, L.activeStreams - 1);
          L.streamsRemaining = Math.max(0, L.streamsRemaining - 1);

          if (L.streamsRemaining === 0) {
            const elapsed = Math.round((state.t - L.batchStartedAt) * MS_PER_SEC);
            L.lastPageMs = elapsed;
            L.pageMs = L.pageMs === 0 ? elapsed : Math.round(emaEvent(L.pageMs, elapsed, LAT_EMA_RATE));
          }
        }
      }
    }

    // Publish metrics
    state.metrics.pageMs = L.pageMs > 0 ? L.pageMs : L.lastPageMs;
    state.metrics.tcpStallMs = L.tcpStallMs;
    state.metrics.framesDelivered = L.framesDelivered;
    state.metrics.activeStreams = L.activeStreams;
  },

  meters: [
    { metricKey: "pageMs", label: "page load time", kind: "gauge", max: 3000, unit: "ms" },
    { metricKey: "tcpStallMs", label: "TCP HOL stall", kind: "gauge", max: 1500, unit: "ms" },
    { metricKey: "activeStreams", label: "active streams", kind: "counter" },
    { metricKey: "framesDelivered", label: "frames delivered", kind: "counter" },
  ],
};
