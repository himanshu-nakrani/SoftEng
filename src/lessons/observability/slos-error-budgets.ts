import {
  advancePackets,
  approach,
  bounceDrop,
  clamp01,
  emaRate,
  recordSample,
  shouldSpawn,
  spawnPacket,
} from "@/engine/sim-helpers";
import type { LessonSim } from "@/engine/types";

interface SloState {
  requests: number;
  failures: number;
  completed: number;
  throughput: number;
  rolloutLive: boolean;
  paused: boolean;
}

const SLO_TARGET = 99.9;
const BUDGET_PPM = 1_000; // 0.1% of one million opportunities

/**
 * SLOs & Error Budgets — availability is a release constraint, not a vanity
 * number. A bad rollout burns the error budget faster than the calendar can
 * replenish it; pausing the rollout stops compounding the incident.
 */
export const slosErrorBudgetsSim: LessonSim<SloState> = {
  id: "slos-error-budgets",

  topology: {
    nodes: [
      { id: "users", kind: "client", label: "users", x: 115, y: 225 },
      { id: "edge", kind: "loadbalancer", label: "edge", x: 310, y: 225 },
      { id: "api", kind: "server", label: "search-api", x: 505, y: 225 },
      { id: "index", kind: "database", label: "search-index", x: 700, y: 225 },
    ],
    edges: [
      { id: "users-edge", from: "users", to: "edge" },
      { id: "edge-api", from: "edge", to: "api" },
      { id: "api-index", from: "api", to: "index" },
    ],
  },

  params: [
    {
      key: "traffic",
      label: "traffic",
      kind: "slider",
      min: 8,
      max: 40,
      step: 1,
      unit: " req/s",
      defaultValue: 20,
    },
    {
      key: "canary",
      label: "new release traffic",
      kind: "slider",
      min: 0,
      max: 100,
      step: 5,
      unit: "%",
      defaultValue: 10,
    },
    {
      key: "window",
      label: "SLO window",
      kind: "select",
      defaultValue: "30d",
      options: [
        { value: "1h", label: "1 hour" },
        { value: "7d", label: "7 days" },
        { value: "30d", label: "30 days" },
      ],
    },
    {
      key: "pause-rollout",
      label: "pause rollout",
      kind: "button",
      defaultValue: false,
    },
  ],

  init: () => ({
    requests: 0,
    failures: 0,
    completed: 0,
    throughput: 0,
    rolloutLive: false,
    paused: false,
  }),

  step: (state, dt, params) => {
    const L = state.lesson;
    if (params["pause-rollout"] === true) {
      L.paused = true;
      params["pause-rollout"] = false;
    }

    const traffic = Number(params.traffic);
    const canary = L.paused ? 0 : Number(params.canary);
    const newReleaseShare = L.rolloutLive ? canary / 100 : 0;
    // The release has a deterministic defect: it is harmless at a tiny canary
    // and increasingly obvious as traffic is shifted to it.
    const defectRate = newReleaseShare * (0.012 + newReleaseShare * 0.07);
    const overloaded = traffic > 31 ? (traffic - 31) * 0.004 : 0;
    const failureChance = defectRate + overloaded;
    const packetSpeed = 2;

    const incoming = shouldSpawn(state, traffic, dt);
    let failuresNow = 0;
    let completedNow = 0;
    for (let i = 0; i < incoming; i++) {
      L.requests += 1;
      const fails = state.rng() < failureChance;
      spawnPacket(state, "users-edge", fails ? "limited" : "request", {
        speed: packetSpeed,
      });
      if (fails) {
        L.failures += 1;
        failuresNow += 1;
      }
    }

    for (const packet of advancePackets(state, dt)) {
      if (packet.type === "limited") {
        // Only the outbound rejected request is bounced. The reverse packet is
        // already returning to the user and should disappear at that endpoint.
        if (packet.edgeId === "users-edge" && !packet.reverse) {
          bounceDrop(state, "users-edge", { speed: packetSpeed * 1.2, type: "limited" });
        }
      } else if (packet.type === "request") {
        if (packet.edgeId === "users-edge") {
          spawnPacket(state, "edge-api", "request", { speed: packetSpeed });
        } else if (packet.edgeId === "edge-api") {
          spawnPacket(state, "api-index", "request", { speed: packetSpeed });
        } else if (packet.edgeId === "api-index") {
          spawnPacket(state, "api-index", "response", {
            speed: packetSpeed,
            reverse: true,
          });
        }
      } else if (packet.type === "response") {
        if (packet.edgeId === "api-index") {
          spawnPacket(state, "edge-api", "response", {
            speed: packetSpeed,
            reverse: true,
          });
        } else if (packet.edgeId === "edge-api") {
          spawnPacket(state, "users-edge", "response", {
            speed: packetSpeed,
            reverse: true,
          });
        } else if (packet.edgeId === "users-edge") {
          L.completed += 1;
          completedNow += 1;
        }
      }
    }

    L.throughput = emaRate(L.throughput, completedNow, dt);
    const availability = 100 * (1 - L.failures / Math.max(L.requests, 1));
    const consumedPpm = (L.failures / Math.max(L.requests, 1)) * 1_000_000;
    const budgetRemaining = clamp01(1 - consumedPpm / BUDGET_PPM) * 100;
    const windowScale = params.window === "1h" ? 1.8 : params.window === "7d" ? 1.25 : 1;
    const burnRate = (consumedPpm / BUDGET_PPM) * windowScale;

    state.metrics.availability = availability;
    state.metrics.budget = budgetRemaining;
    state.metrics.burn = burnRate;
    state.metrics.throughput = L.throughput;
    state.metrics.rollout = L.rolloutLive && !L.paused ? canary : 0;
    recordSample(state, "budget", budgetRemaining);

    const load = clamp01(traffic / 40);
    state.nodes.edge.load = approach(state.nodes.edge.load, load, 4, dt);
    state.nodes.api.load = approach(
      state.nodes.api.load,
      clamp01(load + newReleaseShare * 0.25),
      4,
      dt,
    );
    state.nodes.index.load = approach(state.nodes.index.load, load, 4, dt);
    state.nodes.api.meta = {
      rollout: L.rolloutLive && !L.paused ? canary : 0,
      paused: L.paused,
      failuresNow,
    };
  },

  timeline: [
    {
      at: 1.5,
      caption: "The SLO is 99.9% availability. Its error budget is the allowed failure rate, expressed as a release constraint.",
    },
    {
      at: 8,
      caption: "A new search-api release begins at the canary percentage. Increase it carefully: the release is not clean.",
      apply: (state) => {
        state.lesson.rolloutLive = true;
      },
    },
    {
      at: 17,
      caption: "Watch burn rate, not only availability. A budget can look mostly full while disappearing far too fast.",
    },
    {
      at: 25,
      caption: "Try PAUSE ROLLOUT. The correct operational move is often to stop making the incident larger.",
    },
  ],

  quiz: [
    {
      id: "slo-burn-rate",
      at: 15.5,
      question:
        "Availability is still close to the target, but the error budget is burning at 12× its sustainable rate during a rollout. What is the best next move?",
      choices: [
        { id: "continue", label: "Continue; the average availability is still high" },
        { id: "pause", label: "Pause or roll back the rollout, then investigate" },
        { id: "wait", label: "Wait until the entire budget is exhausted" },
      ],
      correctChoiceId: "pause",
      explain:
        "An error budget is a forward-looking release constraint. A high burn rate means the current failure rate would consume the allowance far earlier than the SLO window. Pausing limits blast radius while diagnosis begins.",
    },
  ],

  meters: [
    {
      metricKey: "availability",
      label: "availability",
      kind: "gauge",
      max: 100,
      unit: "%",
      decimals: 2,
      dangerBelow: SLO_TARGET,
    },
    {
      metricKey: "budget",
      label: "error budget left",
      kind: "sparkline",
      unit: "%",
      dangerBelow: 25,
    },
    {
      metricKey: "burn",
      label: "budget burn",
      kind: "counter",
      unit: "×",
      decimals: 1,
      dangerAbove: 1,
    },
    {
      metricKey: "rollout",
      label: "release traffic",
      kind: "bar",
      max: 100,
      unit: "%",
      dangerAbove: 50,
    },
  ],

  packetLegend: [
    { type: "request", label: "healthy request" },
    { type: "response", label: "successful response" },
    { type: "limited", label: "release failure" },
  ],
};
