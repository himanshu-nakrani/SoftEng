import {
  advancePackets,
  approach,
  bounceDrop,
  clamp01,
  drainQueue,
  emaRate,
  isAlive,
  recordSample,
  shouldSpawn,
  spawnPacket,
  type ServiceQueue,
} from "@/engine/sim-helpers";
import type { LessonSim } from "@/engine/types";

interface IncidentState {
  retries: ServiceQueue;
  requests: number;
  errors: number;
  completed: number;
  throughput: number;
  incident: boolean;
  shedding: boolean;
}

const RETRY_LIMIT = 42;

/**
 * Incident Triage — the dependency fails, retry traffic grows, and the learner
 * has to use signals to choose a mitigation that reduces rather than amplifies
 * the blast radius.
 */
export const incidentTriageSim: LessonSim<IncidentState> = {
  id: "incident-triage",

  topology: {
    nodes: [
      { id: "users", kind: "client", label: "users", x: 85, y: 225 },
      { id: "gateway", kind: "loadbalancer", label: "gateway", x: 270, y: 225 },
      { id: "api", kind: "server", label: "checkout-api", x: 455, y: 225 },
      {
        id: "payments",
        kind: "server",
        label: "payments",
        x: 640,
        y: 225,
        breakable: true,
      },
    ],
    edges: [
      { id: "users-gateway", from: "users", to: "gateway" },
      { id: "gateway-api", from: "gateway", to: "api" },
      { id: "api-payments", from: "api", to: "payments" },
    ],
  },

  params: [
    {
      key: "traffic",
      label: "checkout traffic",
      kind: "slider",
      min: 5,
      max: 36,
      step: 1,
      unit: " req/s",
      defaultValue: 16,
    },
    {
      key: "timeout",
      label: "downstream timeout",
      kind: "slider",
      min: 100,
      max: 1600,
      step: 100,
      unit: "ms",
      defaultValue: 800,
    },
    {
      key: "retry-policy",
      label: "retry policy",
      kind: "select",
      defaultValue: "immediate",
      options: [
        { value: "none", label: "no retry" },
        { value: "immediate", label: "immediate retry" },
        { value: "backoff", label: "exponential backoff" },
      ],
    },
    {
      key: "shed-load",
      label: "shed non-critical load",
      kind: "button",
      defaultValue: false,
    },
  ],

  init: () => ({
    retries: { depth: 0, acc: 0 },
    requests: 0,
    errors: 0,
    completed: 0,
    throughput: 0,
    incident: false,
    shedding: false,
  }),

  step: (state, dt, params) => {
    const L = state.lesson;
    if (params["shed-load"] === true) {
      L.shedding = true;
      params["shed-load"] = false;
    }

    const configuredTraffic = Number(params.traffic);
    const admittedTraffic = L.shedding ? configuredTraffic * 0.55 : configuredTraffic;
    const packetSpeed = 2.05;
    const retryPolicy = String(params["retry-policy"]);
    const paymentsAlive = isAlive(state, "payments");

    const incoming = shouldSpawn(state, configuredTraffic, dt);
    for (let i = 0; i < incoming; i++) {
      L.requests += 1;
      if (state.rng() > admittedTraffic / configuredTraffic) {
        bounceDrop(state, "users-gateway", { speed: packetSpeed, type: "limited" });
      } else {
        spawnPacket(state, "users-gateway", "request", { speed: packetSpeed });
      }
    }

    let completedNow = 0;
    for (const packet of advancePackets(state, dt)) {
      if (packet.type === "request") {
        if (packet.edgeId === "users-gateway") {
          spawnPacket(state, "gateway-api", "request", { speed: packetSpeed });
        } else if (packet.edgeId === "gateway-api") {
          spawnPacket(state, "api-payments", "request", { speed: packetSpeed });
        } else if (packet.edgeId === "api-payments") {
          if (!paymentsAlive) {
            L.errors += 1;
            if (retryPolicy !== "none" && L.retries.depth < RETRY_LIMIT) {
              L.retries.depth += retryPolicy === "immediate" ? 1.6 : 1;
            }
            bounceDrop(state, "api-payments", { speed: packetSpeed * 1.25 });
          } else {
            spawnPacket(state, "api-payments", "response", {
              speed: packetSpeed,
              reverse: true,
            });
          }
        }
      } else if (packet.type === "response") {
        if (packet.edgeId === "api-payments") {
          spawnPacket(state, "gateway-api", "response", {
            speed: packetSpeed,
            reverse: true,
          });
        } else if (packet.edgeId === "gateway-api") {
          spawnPacket(state, "users-gateway", "response", {
            speed: packetSpeed,
            reverse: true,
          });
        } else if (packet.edgeId === "users-gateway") {
          L.completed += 1;
          completedNow += 1;
        }
      }
    }

    const retryCapacity = retryPolicy === "immediate" ? 22 : retryPolicy === "backoff" ? 5 : 0;
    drainQueue(L.retries, retryCapacity, dt, () => {
      if (paymentsAlive) {
        spawnPacket(state, "api-payments", "request", { speed: packetSpeed });
      } else if (L.retries.depth < RETRY_LIMIT) {
        // Immediate retry recirculates while the dependency remains dead.
        L.retries.depth += retryPolicy === "immediate" ? 0.8 : 0.2;
      }
    });

    L.throughput = emaRate(L.throughput, completedNow, dt);
    const errorRate = (100 * L.errors) / Math.max(L.requests, 1);
    const p99 = Number(params.timeout) + L.retries.depth * 26 + (paymentsAlive ? 90 : 240);

    state.metrics.p99 = p99;
    state.metrics.errors = errorRate;
    state.metrics.retries = L.retries.depth;
    state.metrics.throughput = L.throughput;
    state.metrics.shedding = L.shedding ? 1 : 0;
    recordSample(state, "retries", L.retries.depth);

    state.nodes.gateway.load = approach(
      state.nodes.gateway.load,
      clamp01(admittedTraffic / 36),
      4,
      dt,
    );
    state.nodes.api.load = approach(
      state.nodes.api.load,
      clamp01((admittedTraffic + L.retries.depth * 0.55) / 36),
      4,
      dt,
    );
    state.nodes.payments.load = approach(
      state.nodes.payments.load,
      paymentsAlive ? clamp01(admittedTraffic / 30) : 0,
      5,
      dt,
    );
    state.nodes.api.queueDepth = Math.round(L.retries.depth);
    state.nodes.api.meta = {
      retryPolicy,
      shedding: L.shedding,
      incident: L.incident,
    };
  },

  timeline: [
    { at: 1.5, caption: "A checkout request crosses gateway → checkout-api → payments, then returns green." },
    {
      at: 9,
      caption: "☠ Payments goes down. Observe the symptom first: p99 rises, errors follow, and retries begin to queue.",
      apply: (state) => {
        state.lesson.incident = true;
        state.nodes.payments.health = "dead";
      },
    },
    {
      at: 16,
      caption: "Immediate retries are new traffic aimed at a dead dependency. Inspect the retry queue before changing knobs.",
    },
    {
      at: 25,
      caption: "Try exponential backoff and SHED NON-CRITICAL LOAD. Mitigation should reduce work, not create more of it.",
    },
  ],

  quiz: [
    {
      id: "triage-retry-storm",
      at: 18,
      question:
        "Payments is down, the retry queue is growing, and checkout p99 is rising. Which response most directly limits the blast radius?",
      choices: [
        { id: "retry", label: "Increase immediate retries so more requests get a chance" },
        { id: "mitigate", label: "Apply backoff and shed non-critical load while investigating" },
        { id: "timeout", label: "Raise the timeout so every request waits longer" },
      ],
      correctChoiceId: "mitigate",
      explain:
        "A dead dependency cannot benefit from more simultaneous attempts. Backoff slows the retry feedback loop and load shedding protects the surviving path, leaving capacity for recovery and diagnosis.",
    },
  ],

  meters: [
    {
      metricKey: "p99",
      label: "checkout p99",
      kind: "counter",
      unit: "ms",
      dangerAbove: 1200,
    },
    {
      metricKey: "errors",
      label: "error rate",
      kind: "gauge",
      max: 30,
      unit: "%",
      dangerAbove: 1,
    },
    {
      metricKey: "retries",
      label: "retry queue",
      kind: "sparkline",
      dangerAbove: RETRY_LIMIT * 0.55,
    },
    {
      metricKey: "throughput",
      label: "completed",
      kind: "counter",
      unit: " req/s",
    },
  ],

  packetLegend: [
    { type: "request", label: "checkout request" },
    { type: "response", label: "successful response" },
    { type: "drop", label: "timeout / failed call" },
    { type: "limited", label: "shed request" },
  ],
};
