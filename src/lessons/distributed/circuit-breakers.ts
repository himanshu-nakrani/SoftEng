import {
  advancePackets,
  approach,
  spawnPacket,
  shouldSpawn,
} from "@/engine/sim-helpers";
import type { LessonSim, SimState } from "@/engine/types";

/**
 * B3 — Circuit Breakers & Retry Storms. A dependency browns out mid-run.
 * Naive retries amplify load onto the struggling service (the storm);
 * a circuit breaker fails fast, sheds that load, and probes for recovery.
 *
 * Breaker states are shown on the api node: healthy = CLOSED,
 * degraded (orange) = OPEN / HALF-OPEN.
 */

type BreakerState = "closed" | "open" | "half";

interface CBState {
  browned: boolean;
  /** Scheduled retries: when, which attempt, original birth time. */
  retryQueue: { at: number; attempt: number; createdAt: number }[];
  breaker: BreakerState;
  openedAt: number;
  /** Rolling window of recent downstream outcomes (true = success). */
  window: boolean[];
  probeInFlight: boolean;
  successEma: number;
  /** Per-tick downstream send counts, 3s sliding window. */
  downWindow: number[];
  downstreamThisTick: number;
  userFailures: number;
}

const MAX_RETRIES = 2;
const FAIL_HEALTHY = 0.02;
const FAIL_BROWNED = 0.7;
const OPEN_COOLDOWN = 4; // seconds before a half-open probe
const WINDOW = 8;
const TRIP_FAILS = 5;

function sendDownstream(
  state: SimState<CBState>,
  attempt: number,
  createdAt: number,
  probe = false,
) {
  state.lesson.downstreamThisTick += 1;
  spawnPacket(state, "down", probe ? "heartbeat" : "request", {
    speed: 1.6,
    size: probe ? 3 : undefined,
    payload: { attempt, createdAt, probe },
  });
}

export const circuitBreakersSim: LessonSim<CBState> = {
  id: "circuit-breakers",

  topology: {
    nodes: [
      { id: "client", kind: "client", label: "checkout", x: 120, y: 225 },
      { id: "api", kind: "server", label: "orders-api", x: 390, y: 225 },
      { id: "dep", kind: "server", label: "payments", x: 660, y: 225, breakable: true },
    ],
    edges: [
      { id: "front", from: "client", to: "api" },
      { id: "down", from: "api", to: "dep" },
    ],
  },

  params: [
    {
      key: "rate",
      label: "checkout rate",
      kind: "slider",
      min: 2,
      max: 14,
      step: 1,
      unit: " req/s",
      defaultValue: 6,
    },
    {
      key: "retries",
      label: "on failure",
      kind: "select",
      options: [
        { value: "none", label: "give up" },
        { value: "immediate", label: "retry now" },
        { value: "backoff", label: "backoff" },
      ],
      defaultValue: "immediate",
    },
    {
      key: "breaker",
      label: "circuit breaker",
      kind: "toggle",
      defaultValue: false,
    },
  ],

  init: () => ({
    browned: false,
    retryQueue: [],
    breaker: "closed",
    openedAt: 0,
    window: [],
    probeInFlight: false,
    successEma: 1,
    downWindow: [],
    downstreamThisTick: 0,
    userFailures: 0,
  }),

  step: (state, dt, params) => {
    const L = state.lesson;
    const breakerEnabled = params.breaker === true;
    const policy = String(params.retries);
    L.downstreamThisTick = 0;

    // 0. Breaker state machine (only when enabled).
    if (!breakerEnabled && L.breaker !== "closed") {
      L.breaker = "closed";
      L.window = [];
    }
    if (breakerEnabled) {
      const fails = L.window.filter((ok) => !ok).length;
      if (L.breaker === "closed" && L.window.length >= WINDOW && fails >= TRIP_FAILS) {
        L.breaker = "open";
        L.openedAt = state.t;
        L.retryQueue = []; // shed scheduled retries with the trip
      } else if (
        L.breaker === "open" &&
        state.t - L.openedAt > OPEN_COOLDOWN &&
        !L.probeInFlight
      ) {
        L.breaker = "half";
        L.probeInFlight = true;
        sendDownstream(state, 0, state.t, true);
      }
    }
    state.nodes.api.health = L.breaker === "closed" ? "healthy" : "degraded";

    // 1. Checkout traffic.
    for (let i = 0; i < shouldSpawn(state, Number(params.rate), dt); i++) {
      spawnPacket(state, "front", "request", {
        speed: 1.6,
        payload: { createdAt: state.t },
      });
    }

    // 2. Due retries.
    const due = L.retryQueue.filter((r) => r.at <= state.t);
    L.retryQueue = L.retryQueue.filter((r) => r.at > state.t);
    for (const r of due) {
      if (L.breaker === "closed") {
        sendDownstream(state, r.attempt, r.createdAt);
      } else {
        L.userFailures += 1;
        L.successEma = approach(L.successEma, 0, 0.12, 1);
      }
    }

    // 3. Deliveries.
    for (const p of advancePackets(state, dt)) {
      const attempt = Number(p.payload?.attempt ?? 0);
      const createdAt = Number(p.payload?.createdAt ?? state.t);

      if (p.edgeId === "front" && p.type === "request") {
        // At the api: forward downstream, or fail fast while the breaker
        // is protecting the dependency.
        if (breakerEnabled && L.breaker !== "closed") {
          L.userFailures += 1;
          L.successEma = approach(L.successEma, 0, 0.12, 1);
          spawnPacket(state, "front", "limited", {
            speed: 2,
            reverse: true,
            size: 3,
          });
        } else {
          sendDownstream(state, 0, createdAt);
        }
      } else if (p.edgeId === "down" && (p.type === "request" || p.type === "heartbeat")) {
        // At the dependency: succeed or fail.
        const dead = state.nodes.dep.health === "dead";
        const pFail = dead ? 1 : L.browned ? FAIL_BROWNED : FAIL_HEALTHY;
        if (state.rng() < pFail) {
          spawnPacket(state, "down", "drop", {
            speed: 1.9,
            reverse: true,
            size: 3,
            payload: { attempt, createdAt, probe: p.payload?.probe },
          });
        } else {
          spawnPacket(state, "down", "response", {
            speed: 1.6,
            reverse: true,
            payload: { attempt, createdAt, probe: p.payload?.probe },
          });
        }
      } else if (p.edgeId === "down" && p.type === "response") {
        // Back at the api: success.
        if (p.payload?.probe === true) {
          L.probeInFlight = false;
          L.breaker = "closed";
          L.window = [];
        } else {
          L.window.push(true);
          if (L.window.length > WINDOW) L.window.shift();
          L.successEma = approach(L.successEma, 1, 0.12, 1);
          spawnPacket(state, "front", "response", { speed: 1.6, reverse: true });
        }
      } else if (p.edgeId === "down" && p.type === "drop") {
        // Back at the api: failure.
        if (p.payload?.probe === true) {
          L.probeInFlight = false;
          L.breaker = "open";
          L.openedAt = state.t;
          continue;
        }
        L.window.push(false);
        if (L.window.length > WINDOW) L.window.shift();
        if (policy !== "none" && attempt < MAX_RETRIES) {
          const delay =
            policy === "immediate" ? 0.05 : Math.pow(2, attempt) * 1;
          L.retryQueue.push({
            at: state.t + delay,
            attempt: attempt + 1,
            createdAt,
          });
        } else {
          L.userFailures += 1;
          L.successEma = approach(L.successEma, 0, 0.12, 1);
          spawnPacket(state, "front", "drop", {
            speed: 1.9,
            reverse: true,
            size: 3,
          });
        }
      }
    }

    // 4. Readouts. Downstream rate = exact count over a 3s sliding window.
    L.downWindow.push(L.downstreamThisTick);
    if (L.downWindow.length > 90) L.downWindow.shift();
    const downRate =
      L.downWindow.reduce((a, b) => a + b, 0) / (L.downWindow.length * dt);
    state.nodes.dep.load = approach(
      state.nodes.dep.load,
      Math.min(downRate / 14, 1),
      6,
      dt,
    );
    state.metrics.successPct = L.successEma * 100;
    state.metrics.downstream = downRate;
    state.metrics.failures = L.userFailures;
  },

  timeline: [
    {
      at: 2,
      caption:
        "checkout → orders-api → payments. Watch DOWNSTREAM: it should match checkout rate.",
    },
    {
      at: 10,
      caption: "⚠ payments browns out — 70% of calls start failing.",
      apply: (s) => {
        s.lesson.browned = true;
        s.nodes.dep.health = "degraded";
      },
    },
    {
      at: 16,
      caption:
        "That's a retry storm: DOWNSTREAM ~2× while payments drowns. Flip the CIRCUIT BREAKER on.",
    },
    {
      at: 26,
      caption: "payments recovers. A half-open probe will notice shortly…",
      apply: (s) => {
        s.lesson.browned = false;
        if (s.nodes.dep.health === "degraded") s.nodes.dep.health = "healthy";
      },
    },
  ],

  quiz: [
    {
      id: "storm-math",
      at: 13,
      question:
        "payments is failing 70% of calls, and every failure triggers an immediate retry (up to 2). What load does the struggling service now see?",
      choices: [
        { id: "double", label: "~2.2× normal — right when it can least afford it" },
        { id: "same", label: "The same — retries replace requests, not add to them" },
        { id: "less", label: "Less — failures return early and free capacity" },
      ],
      correctChoiceId: "double",
      explain:
        "Each original call spawns expected 0.7 retries, then 0.49 more: 1 + 0.7 + 0.49 ≈ 2.2×. Retries convert partial failure into extra load at the exact moment capacity is scarcest — the storm that turns a brownout into an outage. Backoff spreads it; a breaker stops it.",
    },
  ],

  meters: [
    {
      metricKey: "successPct",
      label: "checkout success",
      kind: "gauge",
      max: 100,
      unit: "%",
      dangerBelow: 60,
    },
    {
      metricKey: "downstream",
      label: "downstream",
      kind: "counter",
      unit: " req/s",
      decimals: 1,
      dangerAbove: 11,
    },
    {
      metricKey: "failures",
      label: "failed checkouts",
      kind: "counter",
      dangerAbove: 0,
    },
  ],
};
