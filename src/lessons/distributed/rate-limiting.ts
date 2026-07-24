import {
  advancePackets,
  approach,
  bounceDrop,
  clamp01,
  emaRate,
  shouldSpawn,
  spawnPacket,
} from "@/engine/sim-helpers";
import type { LessonSim } from "@/engine/types";

/**
 * Lesson 8 — Rate Limiting (token bucket). Tokens refill steadily; each
 * request spends one or bounces 429-red. The BURST button is the exam.
 */

interface RLState {
  tokens: number;
  burstRemaining: number;
  allowedEma: number;
  rejectedTotal: number;
}

export const rateLimitingSim: LessonSim<RLState> = {
  id: "rate-limiting",

  topology: {
    nodes: [
      { id: "client", kind: "client", label: "clients", x: 130, y: 225 },
      { id: "limiter", kind: "loadbalancer", label: "limiter", x: 400, y: 225 },
      { id: "api", kind: "server", label: "api-1", x: 660, y: 225 },
    ],
    edges: [
      { id: "in", from: "client", to: "limiter" },
      { id: "out", from: "limiter", to: "api" },
    ],
  },

  params: [
    {
      key: "refill",
      label: "refill rate",
      kind: "slider",
      min: 1,
      max: 15,
      step: 1,
      unit: " tok/s",
      defaultValue: 5,
    },
    {
      key: "bucket",
      label: "bucket size",
      kind: "slider",
      min: 2,
      max: 30,
      step: 1,
      unit: " tok",
      defaultValue: 10,
    },
    {
      key: "rate",
      label: "request rate",
      kind: "slider",
      min: 1,
      max: 25,
      step: 1,
      unit: " req/s",
      defaultValue: 4,
    },
    {
      key: "burst",
      label: "send burst",
      kind: "button",
      defaultValue: false,
    },
  ],

  init: () => ({
    tokens: 10,
    burstRemaining: 0,
    allowedEma: 0,
    rejectedTotal: 0,
  }),

  step: (state, dt, params) => {
    const L = state.lesson;
    const bucket = Number(params.bucket);

    // Momentary BURST button → 30 extra requests over ~1.5s.
    if (params.burst === true) {
      L.burstRemaining += 30;
      params.burst = false; // consume the press
    }

    // 1. Refill.
    L.tokens = Math.min(L.tokens + Number(params.refill) * dt, bucket);

    // 2. Arrivals: steady rate + any burst in progress.
    let spawns = shouldSpawn(state, Number(params.rate), dt);
    if (L.burstRemaining > 0) {
      const burstNow = Math.min(L.burstRemaining, Math.ceil(20 * dt));
      L.burstRemaining -= burstNow;
      spawns += burstNow;
    }
    for (let i = 0; i < spawns; i++) {
      spawnPacket(state, "in", "request", { speed: 1.7 });
    }

    // 3. Deliveries.
    let allowedNow = 0;
    for (const p of advancePackets(state, dt)) {
      if (p.edgeId === "in" && p.type === "request") {
        if (L.tokens >= 1) {
          L.tokens -= 1;
          spawnPacket(state, "out", "request", { speed: 1.5 });
        } else {
          L.rejectedTotal += 1;
          bounceDrop(state, "in", { type: "limited", speed: 1.9 });
        }
      } else if (p.edgeId === "out" && p.type === "request") {
        allowedNow += 1;
        spawnPacket(state, "out", "response", { speed: 1.5, reverse: true });
      } else if (p.edgeId === "out" && p.type === "response") {
        spawnPacket(state, "in", "response", { speed: 1.7, reverse: true });
      }
    }

    // 4. Readouts.
    L.allowedEma = emaRate(L.allowedEma, allowedNow, dt);
    state.nodes.limiter.queueDepth = Math.floor(L.tokens);
    state.nodes.limiter.load = approach(
      state.nodes.limiter.load,
      1 - clamp01(L.tokens / bucket),
      6,
      dt,
    );
    state.metrics.tokens = L.tokens;
    state.metrics.allowed = L.allowedEma;
    state.metrics.rejected = L.rejectedTotal;
  },

  timeline: [
    {
      at: 2,
      caption:
        "The limiter's chip is its token count. Every forwarded request spends one.",
    },
    {
      at: 8,
      caption:
        "Requests slower than the refill rate? The bucket stays full — burst headroom.",
    },
    {
      at: 15,
      caption: "⚡ Hit SEND BURST and watch the red 429s once the bucket empties.",
    },
  ],

  quiz: [
    {
      id: "bucket-burst",
      at: 12,
      question:
        "The bucket holds 10 tokens (full), refilling at 5/s. A burst of 30 requests lands at once. What happens?",
      choices: [
        {
          id: "partial",
          label: "First ~10 pass instantly; the rest get 429s as tokens trickle in",
        },
        { id: "queue", label: "All 30 queue up and eventually succeed" },
        { id: "reject", label: "All 30 are rejected — bursts aren't allowed" },
      ],
      correctChoiceId: "partial",
      explain:
        "That's the token bucket's signature: the bucket depth absorbs a burst up to its size instantly, then the refill rate becomes the hard ceiling. Depth = burst tolerance, refill = sustained rate. Two knobs, two different promises.",
    },
  ],

  meters: [
    {
      metricKey: "tokens",
      label: "tokens",
      kind: "bar",
      max: 30,
      decimals: 0,
    },
    {
      metricKey: "allowed",
      label: "allowed",
      kind: "counter",
      unit: " req/s",
    },
    {
      metricKey: "rejected",
      label: "429 rejected",
      kind: "counter",
      dangerAbove: 0,
    },
  ],
};
