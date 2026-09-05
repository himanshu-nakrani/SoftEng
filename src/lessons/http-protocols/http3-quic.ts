import {
  advancePackets,
  emaEvent,
  spawnPacket,
} from "@/engine/sim-helpers";
import type { LessonSim } from "@/engine/types";

/**
 * QUIC & HTTP/3: Independent UDP Streams — archetype A (the packet engine).
 *
 * In HTTP/2, multiple logical streams share a single TCP connection. When an IP
 * packet drops, TCP halts the entire connection — freezing all streams together
 * because TCP guarantees strict in-order delivery of bytes.
 *
 * HTTP/3 moves transport from TCP to QUIC, which runs on top of UDP. UDP does
 * not enforce in-order delivery at the operating system layer; instead, QUIC
 * implements independent flow control, encryption, and loss recovery per stream.
 *
 * If packet loss occurs on Stream 1, only Stream 1 waits for a retransmission.
 * Streams 2 and 3 continue receiving UDP packets and deliver their data to the
 * browser without a single millisecond of transport head-of-line blocking.
 */

const CLIENT = "client";
const SERVER = "server";
const WIRE = "wire";

const MS_PER_SEC = 1000;
const ONE_WAY = 0.2;
const WIRE_SPEED = 1 / ONE_WAY;

const BATCH_PERIOD = 5.0;
const LAT_EMA_RATE = 0.4;
const RTO_SEC = 0.6; // Retransmit round-trip wait

interface QuicPacket extends Record<string, unknown> {
  streamId: number;
  pktIndex: number;
  totalPkts: number;
  label: string;
}

interface Http3QuicState {
  packetsToSend: QuicPacket[];
  streamsRemaining: number;
  batchStartedAt: number;
  nextBatchAt: number;
  pageMs: number;
  lastPageMs: number;
  holStallMs: number;
  stream2Ms: number;
  lastStream2Ms: number;
  packetsDelivered: number;
  // Per-stream retransmit trackers
  streamStalledUntil: Record<number, number>;
  tcpGlobalStalledUntil: number;
  pendingRetransmits: QuicPacket[];
}

export const http3QuicSim: LessonSim<Http3QuicState> = {
  id: "http3-quic",

  topology: {
    nodes: [
      { id: CLIENT, kind: "client", label: "browser", x: 160, y: 225 },
      { id: SERVER, kind: "server", label: "quic-server", x: 640, y: 225 },
    ],
    edges: [{ id: WIRE, from: CLIENT, to: SERVER }],
  },

  params: [
    {
      key: "protocol",
      label: "protocol",
      kind: "select",
      options: [
        { label: "HTTP/3 (QUIC over UDP)", value: "http3" },
        { label: "HTTP/2 (TCP transport)", value: "http2" },
      ],
      defaultValue: "http3",
    },
    {
      key: "lossRate",
      label: "packet loss",
      kind: "slider",
      min: 0,
      max: 20,
      step: 2,
      unit: "%",
      defaultValue: 10,
    },
  ],

  init: () => ({
    packetsToSend: [],
    streamsRemaining: 0,
    batchStartedAt: 0,
    nextBatchAt: 0.5,
    pageMs: 0,
    lastPageMs: 0,
    holStallMs: 0,
    stream2Ms: 0,
    lastStream2Ms: 0,
    packetsDelivered: 0,
    streamStalledUntil: {},
    tcpGlobalStalledUntil: 0,
    pendingRetransmits: [],
  }),

  step: (state, dt, params) => {
    const L = state.lesson;
    const isQuic = params.protocol !== "http2";
    const lossRate = Number(params.lossRate);

    // 1. Trigger new page load batch
    // Stream 1: CSS (3 pkts)
    // Stream 2: Script (2 pkts)
    // Stream 3: Data (2 pkts)
    if (state.t >= L.nextBatchAt && L.streamsRemaining === 0) {
      L.batchStartedAt = state.t;
      L.streamsRemaining = 3;
      L.nextBatchAt = state.t + BATCH_PERIOD;
      L.streamStalledUntil = {};
      L.tcpGlobalStalledUntil = 0;
      L.pendingRetransmits = [];

      const pkts: QuicPacket[] = [
        { streamId: 1, pktIndex: 1, totalPkts: 3, label: "S1:1" },
        { streamId: 2, pktIndex: 1, totalPkts: 2, label: "S2:1" },
        { streamId: 3, pktIndex: 1, totalPkts: 2, label: "S3:1" },
        { streamId: 1, pktIndex: 2, totalPkts: 3, label: "S1:2" },
        { streamId: 2, pktIndex: 2, totalPkts: 2, label: "S2:2" },
        { streamId: 3, pktIndex: 2, totalPkts: 2, label: "S3:2" },
        { streamId: 1, pktIndex: 3, totalPkts: 3, label: "S1:3" },
      ];
      L.packetsToSend = pkts;
    }

    // 2. Clear expired retransmit waits
    if (!isQuic && L.tcpGlobalStalledUntil > 0) {
      if (state.t >= L.tcpGlobalStalledUntil) {
        L.tcpGlobalStalledUntil = 0;
        // Re-inject retransmits
        while (L.pendingRetransmits.length > 0) {
          const retx = L.pendingRetransmits.shift()!;
          spawnPacket(state, WIRE, "response", {
            speed: WIRE_SPEED,
            reverse: true,
            payload: retx,
          });
        }
      }
    } else if (isQuic) {
      for (const sId of [1, 2, 3]) {
        const stallUntil = L.streamStalledUntil[sId] ?? 0;
        if (stallUntil > 0 && state.t >= stallUntil) {
          L.streamStalledUntil[sId] = 0;
          // Re-inject this stream's lost packet
          const idx = L.pendingRetransmits.findIndex((p) => p.streamId === sId);
          if (idx !== -1) {
            const retx = L.pendingRetransmits.splice(idx, 1)[0];
            spawnPacket(state, WIRE, "response", {
              speed: WIRE_SPEED,
              reverse: true,
              payload: retx,
            });
          }
        }
      }
    }

    // 3. Dispatch packets onto the wire
    if (L.packetsToSend.length > 0) {
      const inFlight = state.packets.filter((p) => p.edgeId === WIRE).length;
      if (inFlight < 2) {
        // Can we dispatch next packet?
        const candidate = L.packetsToSend[0];
        const isBlocked = isQuic
          ? (L.streamStalledUntil[candidate.streamId] ?? 0) > state.t
          : L.tcpGlobalStalledUntil > state.t;

        if (!isBlocked) {
          const pkt = L.packetsToSend.shift()!;
          // Seeded packet drop check
          const drop = lossRate > 0 && state.rng() * 100 < lossRate;
          if (drop) {
            if (isQuic) {
              // QUIC: Only THIS stream stalls
              L.streamStalledUntil[pkt.streamId] = state.t + RTO_SEC;
              L.pendingRetransmits.push(pkt);
              // QUIC HOL stall on OTHER streams is 0
            } else {
              // HTTP/2 over TCP: Global transport stall halts ALL streams
              L.tcpGlobalStalledUntil = state.t + RTO_SEC;
              L.pendingRetransmits.push(pkt);
              const stallMs = Math.round(RTO_SEC * MS_PER_SEC);
              L.holStallMs = L.holStallMs === 0 ? stallMs : Math.round(emaEvent(L.holStallMs, stallMs, LAT_EMA_RATE));
            }
          } else {
            spawnPacket(state, WIRE, "response", {
              speed: WIRE_SPEED,
              reverse: true,
              payload: pkt,
            });
          }
        }
      }
    }

    // 4. Advance packets and process arrivals
    for (const p of advancePackets(state, dt)) {
      if (p.type === "response") {
        const pkt = p.payload as QuicPacket;
        L.packetsDelivered += 1;

        if (pkt && pkt.pktIndex === pkt.totalPkts) {
          // Stream completed
          L.streamsRemaining = Math.max(0, L.streamsRemaining - 1);

          if (pkt.streamId === 2) {
            const s2Elapsed = Math.round((state.t - L.batchStartedAt) * MS_PER_SEC);
            L.lastStream2Ms = s2Elapsed;
            L.stream2Ms = L.stream2Ms === 0 ? s2Elapsed : Math.round(emaEvent(L.stream2Ms, s2Elapsed, LAT_EMA_RATE));
          }

          if (L.streamsRemaining === 0) {
            const pageElapsed = Math.round((state.t - L.batchStartedAt) * MS_PER_SEC);
            L.lastPageMs = pageElapsed;
            L.pageMs = L.pageMs === 0 ? pageElapsed : Math.round(emaEvent(L.pageMs, pageElapsed, LAT_EMA_RATE));
          }
        }
      }
    }

    // Publish metrics
    state.metrics.pageMs = L.pageMs > 0 ? L.pageMs : L.lastPageMs;
    state.metrics.stream2Ms = L.stream2Ms > 0 ? L.stream2Ms : L.lastStream2Ms;
    state.metrics.holStallMs = isQuic ? 0 : L.holStallMs;
    state.metrics.packetsDelivered = L.packetsDelivered;
  },

  meters: [
    { metricKey: "pageMs", label: "page load time", kind: "gauge", max: 3000, unit: "ms" },
    { metricKey: "stream2Ms", label: "stream 2 (script) latency", kind: "gauge", max: 2000, unit: "ms" },
    { metricKey: "holStallMs", label: "transport HOL delay", kind: "gauge", max: 1500, unit: "ms" },
    { metricKey: "packetsDelivered", label: "packets delivered", kind: "counter" },
  ],
};
