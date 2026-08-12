import {
  advancePackets,
  approach,
  bounceDrop,
  clamp01,
  drainQueue,
  emaRate,
  recordSample,
  shouldSpawn,
  spawnPacket,
  type ServiceQueue,
} from "@/engine/sim-helpers";
import type { LessonSim } from "@/engine/types";

interface SignalsState {
  dbQueue: ServiceQueue;
  incident: boolean;
  errors: number;
  total: number;
  throughput: number;
}

const MAX_QUEUE = 36;

/**
 * Metrics, Logs & Traces — one request path, three signal types.
 *
 * The learner can trigger a slow database, then decide which signal to inspect.
 * Aggregate metrics say that something is wrong, logs preserve individual events,
 * and a trace names the slow dependency in the causal request path.
 */
export const metricsLogsTracesSim: LessonSim<SignalsState> = {
  id: "metrics-logs-traces",

  topology: {
    nodes: [
      { id: "browser", kind: "client", label: "browser", x: 90, y: 225 },
      { id: "api", kind: "server", label: "checkout-api", x: 285, y: 225 },
      { id: "worker", kind: "server", label: "orders-worker", x: 480, y: 225 },
      {
        id: "db",
        kind: "database",
        label: "orders-db",
        x: 690,
        y: 225,
        breakable: true,
      },
    ],
    edges: [
      { id: "client-api", from: "browser", to: "api" },
      { id: "api-worker", from: "api", to: "worker" },
      { id: "worker-db", from: "worker", to: "db" },
    ],
  },

  params: [
    {
      key: "traffic",
      label: "request rate",
      kind: "slider",
      min: 4,
      max: 30,
      step: 1,
      unit: " req/s",
      defaultValue: 12,
    },
    {
      key: "db-latency",
      label: "normal db latency",
      kind: "slider",
      min: 30,
      max: 300,
      step: 10,
      unit: "ms",
      defaultValue: 80,
    },
    {
      key: "signal",
      label: "inspect signal",
      kind: "select",
      defaultValue: "metrics",
      options: [
        { value: "metrics", label: "metrics" },
        { value: "logs", label: "logs" },
        { value: "traces", label: "traces" },
      ],
    },
    {
      key: "inject-slow-query",
      label: "inject slow query",
      kind: "button",
      defaultValue: false,
    },
  ],

  init: () => ({
    dbQueue: { depth: 0, acc: 0 },
    incident: false,
    errors: 0,
    total: 0,
    throughput: 0,
  }),

  step: (state, dt, params) => {
    const L = state.lesson;
    if (params["inject-slow-query"] === true) {
      L.incident = true;
      params["inject-slow-query"] = false;
    }

    const traffic = Number(params.traffic);
    const normalDbLatency = Number(params["db-latency"]);
    const dbLatency = L.incident ? Math.max(720, normalDbLatency) : normalDbLatency;
    const dbCapacity = L.incident ? 5 : 28;
    const packetSpeed = 1.9;

    const requests = shouldSpawn(state, traffic, dt);
    for (let i = 0; i < requests; i++) {
      L.total += 1;
      spawnPacket(state, "client-api", "request", { speed: packetSpeed });
    }

    let completedNow = 0;
    for (const packet of advancePackets(state, dt)) {
      if (packet.type === "request") {
        if (packet.edgeId === "client-api") {
          spawnPacket(state, "api-worker", "request", { speed: packetSpeed });
        } else if (packet.edgeId === "api-worker") {
          spawnPacket(state, "worker-db", "request", { speed: packetSpeed });
        } else if (packet.edgeId === "worker-db") {
          if (state.nodes.db.health === "dead" || L.dbQueue.depth >= MAX_QUEUE) {
            L.errors += 1;
            bounceDrop(state, "worker-db", { speed: packetSpeed * 1.2 });
          } else {
            L.dbQueue.depth += 1;
          }
        }
      } else if (packet.type === "response") {
        if (packet.edgeId === "worker-db") {
          spawnPacket(state, "api-worker", "response", {
            speed: packetSpeed,
            reverse: true,
          });
        } else if (packet.edgeId === "api-worker") {
          spawnPacket(state, "client-api", "response", {
            speed: packetSpeed,
            reverse: true,
          });
        } else if (packet.edgeId === "client-api") {
          completedNow += 1;
        }
      }
    }

    if (state.nodes.db.health !== "dead") {
      drainQueue(L.dbQueue, dbCapacity, dt, () => {
        spawnPacket(state, "worker-db", "response", {
          speed: packetSpeed,
          reverse: true,
        });
      });
    }

    L.throughput = emaRate(L.throughput, completedNow, dt);
    const queuePenalty = (L.dbQueue.depth / Math.max(dbCapacity, 1)) * 210;
    const p95 = 65 + dbLatency + queuePenalty;
    const errorRate = (100 * L.errors) / Math.max(L.total, 1);
    const mode = params.signal === "metrics" ? 0 : params.signal === "logs" ? 1 : 2;

    state.metrics.p95 = p95;
    state.metrics.errorRate = errorRate;
    state.metrics.throughput = L.throughput;
    state.metrics.dbQueue = L.dbQueue.depth;
    state.metrics.signalMode = mode;
    state.metrics.incident = L.incident ? 1 : 0;
    recordSample(state, "p95", p95);

    state.nodes.api.load = approach(state.nodes.api.load, clamp01(traffic / 30), 4, dt);
    state.nodes.worker.load = approach(
      state.nodes.worker.load,
      clamp01(L.dbQueue.depth / MAX_QUEUE),
      4,
      dt,
    );
    state.nodes.db.load = approach(
      state.nodes.db.load,
      state.nodes.db.health === "dead" ? 0 : clamp01(L.dbQueue.depth / MAX_QUEUE),
      5,
      dt,
    );
    state.nodes.db.queueDepth = L.dbQueue.depth;
    state.nodes.db.meta = {
      slowQuery: L.incident,
      signal: params.signal,
      latency: Math.round(dbLatency),
    };
  },

  timeline: [
    { at: 1.5, caption: "Green dots return to the browser only after every service has answered." },
    {
      at: 7,
      caption: "Pick a signal. Metrics describe the symptom; logs preserve events; traces connect causality.",
    },
    {
      at: 13,
      caption: "⚡ A slow database query starts. p95 rises before users know which dependency is guilty.",
      apply: (state) => {
        state.lesson.incident = true;
      },
    },
    {
      at: 22,
      caption: "Switch to traces: one request path exposes the slow orders-db span without guessing.",
    },
  ],

  quiz: [
    {
      id: "signals-root-cause",
      at: 17,
      question:
        "p95 latency is rising and checkout requests are slowing. Which signal most directly identifies the dependency causing the delay for one request?",
      choices: [
        { id: "metrics", label: "Metrics — the p95 chart" },
        { id: "logs", label: "Logs — a list of timestamped events" },
        { id: "traces", label: "Traces — spans across the request path" },
      ],
      correctChoiceId: "traces",
      explain:
        "Metrics establish that the system is unhealthy, and logs retain individual events, but a distributed trace preserves parent-child timing across the request. The slow orders-db span identifies the causal hop directly.",
    },
  ],

  meters: [
    {
      metricKey: "p95",
      label: "p95 latency",
      kind: "sparkline",
      unit: "ms",
      dangerAbove: 700,
    },
    {
      metricKey: "errorRate",
      label: "error rate",
      kind: "gauge",
      max: 20,
      unit: "%",
      dangerAbove: 1,
    },
    {
      metricKey: "dbQueue",
      label: "db queue",
      kind: "bar",
      max: MAX_QUEUE,
      dangerAbove: MAX_QUEUE * 0.7,
    },
    {
      metricKey: "throughput",
      label: "completed",
      kind: "counter",
      unit: " req/s",
    },
  ],

  packetStyles: {
    response: { color: "var(--color-glow-green)" },
  },

  packetLegend: [
    { type: "request", label: "request" },
    { type: "response", label: "response" },
    { type: "drop", label: "failed query" },
  ],
};
