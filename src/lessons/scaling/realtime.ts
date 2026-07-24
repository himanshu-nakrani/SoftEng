import {
  advancePackets,
  approach,
  shouldSpawn,
  spawnPacket,
} from "@/engine/sim-helpers";
import type { LessonSim } from "@/engine/types";

/**
 * B1 — WebSockets vs Polling. The server has news; how does the client
 * find out? Polling: keep asking (mostly empty answers). WebSocket: hold
 * the wire open and get pushed the instant it happens.
 *
 * Packet language: amber = the client asking · cyan = empty answer ·
 * green = an actual event delivered.
 */

interface RealtimeState {
  /** Server-side events waiting for delivery (creation time for latency). */
  pending: number[];
  /** Next scheduled poll time (polling mode). */
  nextPollAt: number;
  latencyEma: number; // ms
  delivered: number;
  polls: number;
  emptyPolls: number;
  emptyEma: number; // 0..1
}

const TRAVEL = 0.3; // one-way wire time, seconds (speed 1/0.3)
const SPEED = 1 / TRAVEL;

export const realtimeSim: LessonSim<RealtimeState> = {
  id: "realtime",

  topology: {
    nodes: [
      { id: "client", kind: "client", label: "browser", x: 160, y: 225 },
      { id: "server", kind: "server", label: "events-svc", x: 640, y: 225 },
    ],
    edges: [{ id: "wire", from: "client", to: "server" }],
  },

  params: [
    {
      key: "mode",
      label: "delivery",
      kind: "select",
      options: [
        { value: "poll", label: "polling" },
        { value: "ws", label: "websocket" },
      ],
      defaultValue: "poll",
    },
    {
      key: "eventRate",
      label: "event rate",
      kind: "slider",
      min: 2,
      max: 30,
      step: 1,
      unit: " /min",
      defaultValue: 6,
    },
    {
      key: "pollInterval",
      label: "poll every",
      kind: "slider",
      min: 0.5,
      max: 5,
      step: 0.5,
      unit: "s",
      defaultValue: 2,
    },
  ],

  init: () => ({
    pending: [],
    nextPollAt: 0.5,
    latencyEma: 0,
    delivered: 0,
    polls: 0,
    emptyPolls: 0,
    emptyEma: 0,
  }),

  step: (state, dt, params) => {
    const L = state.lesson;
    const ws = params.mode === "ws";

    // 1. The world produces events, regardless of how anyone listens.
    const events = shouldSpawn(state, Number(params.eventRate) / 60, dt);
    for (let i = 0; i < events; i++) {
      if (ws) {
        // Push immediately: the held-open wire delivers as it happens.
        spawnPacket(state, "wire", "response", {
          speed: SPEED,
          reverse: true,
          payload: { createdAt: state.t },
        });
      } else {
        L.pending.push(state.t);
      }
    }

    // 2. Polling mode: the client asks on its clock.
    if (!ws && state.t >= L.nextPollAt) {
      L.nextPollAt = state.t + Number(params.pollInterval);
      L.polls += 1;
      spawnPacket(state, "wire", "request", { speed: SPEED });
    }
    if (ws) {
      L.nextPollAt = state.t + 0.1; // resume promptly on mode switch
    }

    // 3. Deliveries.
    for (const p of advancePackets(state, dt)) {
      if (p.type === "request") {
        // Poll arrived at the server: anything for me?
        if (L.pending.length > 0) {
          const batch = L.pending;
          L.pending = [];
          spawnPacket(state, "wire", "response", {
            speed: SPEED,
            reverse: true,
            payload: { createdAt: Math.min(...batch), count: batch.length },
          });
        } else {
          L.emptyPolls += 1;
          L.emptyEma = approach(L.emptyEma, 1, 0.8, 1);
          spawnPacket(state, "wire", "miss", {
            speed: SPEED,
            reverse: true,
            size: 3,
          });
        }
      } else if (p.type === "response") {
        // Payload reached the client — measure end-to-end delivery.
        const createdAt = Number(p.payload?.createdAt ?? state.t);
        const count = Number(p.payload?.count ?? 1);
        L.delivered += count;
        L.latencyEma = approach(
          L.latencyEma || (state.t - createdAt) * 1000,
          (state.t - createdAt) * 1000,
          0.6,
          1,
        );
        L.emptyEma = approach(L.emptyEma, 0, 0.4, 1);
      }
      // "miss" (empty poll) reaching the client: nothing to do.
    }

    // 4. Readouts.
    state.nodes.server.queueDepth = L.pending.length;
    state.nodes.server.load = approach(
      state.nodes.server.load,
      Math.min(L.pending.length / 6, 1),
      6,
      dt,
    );
    state.metrics.latency = L.latencyEma;
    state.metrics.emptyPct = L.emptyEma * 100;
    state.metrics.delivered = L.delivered;
    state.metrics.requests = L.polls;
  },

  timeline: [
    {
      at: 2,
      caption:
        "Amber = the client asking. Cyan = 'nothing for you'. Green = an actual event.",
    },
    {
      at: 9,
      caption:
        "Notice the rhythm: ask, nothing, ask, nothing… the server's chip holds undelivered news.",
    },
    {
      at: 15,
      caption:
        "Switch DELIVERY to WEBSOCKET — the asking stops, and events arrive the moment they exist.",
    },
    {
      at: 22,
      caption: "Now crank EVENT RATE. Push delivery doesn't care.",
    },
  ],

  quiz: [
    {
      id: "empty-polls",
      at: 12,
      question:
        "Events arrive about once a minute and the client polls every 2 seconds. Roughly what fraction of polls come back empty?",
      choices: [
        { id: "most", label: "~97% — nearly every poll is wasted" },
        { id: "half", label: "~50% — it averages out" },
        { id: "few", label: "~10% — polls usually catch something" },
      ],
      correctChoiceId: "most",
      explain:
        "30 polls per minute chasing ~1 event: about 29 of 30 return empty-handed. That's the polling tax — request overhead scales with how FRESH you want data, not with how much data exists. Push delivery inverts it: cost scales with events.",
    },
  ],

  meters: [
    {
      metricKey: "latency",
      label: "delivery latency",
      kind: "counter",
      unit: "ms",
      dangerAbove: 2500,
    },
    {
      metricKey: "emptyPct",
      label: "empty polls",
      kind: "gauge",
      max: 100,
      unit: "%",
      dangerAbove: 70,
    },
    {
      metricKey: "delivered",
      label: "events delivered",
      kind: "counter",
    },
    {
      metricKey: "requests",
      label: "polls sent",
      kind: "counter",
    },
  ],
};
