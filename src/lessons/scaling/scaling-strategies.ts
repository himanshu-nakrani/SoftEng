import {
  advancePackets,
  approach,
  bounceDrop,
  clamp01,
  drainQueue,
  emaRate,
  isAlive,
  shouldSpawn,
  spawnPacket,
  type ServiceQueue,
} from "@/engine/sim-helpers";
import type { LessonSim } from "@/engine/types";

/**
 * Lesson 2 — Vertical vs Horizontal Scaling.
 * One SCALE slider, two philosophies: vertical mode gives one server scale×
 * capacity; horizontal mode gives scale servers at 1× each. Same total
 * capacity — completely different blast radius when a machine dies.
 */

interface ScalingState {
  servers: Record<string, ServiceQueue>;
  rr: number;
  droppedTotal: number;
  throughput: number;
}

const UNIT_CAPACITY = 6; // req/s per "1×" of scale
const MAX_QUEUE_PER_UNIT = 10;
const H_IDS = ["h1", "h2", "h3", "h4"] as const;

/** Active server ids + per-server capacity for the current mode/scale. */
function activeSet(params: { mode: unknown; scale: unknown }): {
  ids: string[];
  capacity: (id: string) => number;
  maxQueue: (id: string) => number;
} {
  const scale = Number(params.scale);
  if (params.mode === "vertical") {
    return {
      ids: ["xl"],
      capacity: () => UNIT_CAPACITY * scale,
      maxQueue: () => MAX_QUEUE_PER_UNIT * scale,
    };
  }
  return {
    ids: H_IDS.slice(0, scale),
    capacity: () => UNIT_CAPACITY,
    maxQueue: () => MAX_QUEUE_PER_UNIT,
  };
}

export const scalingStrategiesSim: LessonSim<ScalingState> = {
  id: "scaling-strategies",

  topology: {
    nodes: [
      { id: "client", kind: "client", label: "traffic", x: 130, y: 225 },
      { id: "xl", kind: "server", label: "api-XL", x: 620, y: 80, breakable: true },
      { id: "h1", kind: "server", label: "api-1", x: 620, y: 175, breakable: true },
      { id: "h2", kind: "server", label: "api-2", x: 620, y: 260, breakable: true },
      { id: "h3", kind: "server", label: "api-3", x: 620, y: 345, breakable: true },
      { id: "h4", kind: "server", label: "api-4", x: 620, y: 425, breakable: true },
    ],
    edges: [
      { id: "e-xl", from: "client", to: "xl", curve: -0.18 },
      { id: "e-h1", from: "client", to: "h1", curve: -0.08 },
      { id: "e-h2", from: "client", to: "h2", curve: 0 },
      { id: "e-h3", from: "client", to: "h3", curve: 0.08 },
      { id: "e-h4", from: "client", to: "h4", curve: 0.16 },
    ],
  },

  params: [
    {
      key: "mode",
      label: "strategy",
      kind: "select",
      options: [
        { value: "vertical", label: "vertical (bigger)" },
        { value: "horizontal", label: "horizontal (more)" },
      ],
      defaultValue: "vertical",
    },
    {
      key: "scale",
      label: "scale",
      kind: "slider",
      min: 1,
      max: 4,
      step: 1,
      unit: "×",
      defaultValue: 2,
    },
    {
      key: "rate",
      label: "arrival rate",
      kind: "slider",
      min: 2,
      max: 36,
      step: 1,
      unit: " req/s",
      defaultValue: 10,
    },
  ],

  init: () => ({
    servers: {
      xl: { depth: 0, acc: 0 },
      h1: { depth: 0, acc: 0 },
      h2: { depth: 0, acc: 0 },
      h3: { depth: 0, acc: 0 },
      h4: { depth: 0, acc: 0 },
    },
    rr: 0,
    droppedTotal: 0,
    throughput: 0,
  }),

  step: (state, dt, params) => {
    const L = state.lesson;
    const { ids, capacity, maxQueue } = activeSet({
      mode: params.mode,
      scale: params.scale,
    });

    // Ghost/unghost nodes to match the mode (visual: unprovisioned = dashed).
    for (const id of ["xl", ...H_IDS]) {
      state.nodes[id].ghost = !ids.includes(id);
    }

    const alive = ids.filter((id) => isAlive(state, id));

    // 1. Arrivals — spread evenly across alive servers (the naive
    //    "even spread"; the real traffic cop arrives next lesson).
    const spawns = shouldSpawn(state, Number(params.rate), dt);
    for (let i = 0; i < spawns; i++) {
      if (alive.length === 0) {
        // Total outage: everything bounces.
        L.droppedTotal += 1;
        bounceDrop(state, `e-${ids[0] ?? "xl"}`, { speed: 1.6 });
        continue;
      }
      const target = alive[L.rr++ % alive.length];
      spawnPacket(state, `e-${target}`, "request", { speed: 1.1 });
    }

    // 2. Deliveries.
    let completedNow = 0;
    for (const p of advancePackets(state, dt)) {
      const serverId = p.edgeId.slice(2); // "e-h1" → "h1"
      if (p.type === "request") {
        const server = L.servers[serverId];
        if (!isAlive(state, serverId) || server.depth >= maxQueue(serverId)) {
          L.droppedTotal += 1;
          bounceDrop(state, p.edgeId, { speed: 1.6 });
        } else {
          server.depth += 1;
        }
      } else if (p.type === "response") {
        completedNow += 1;
      }
    }

    // 3. Service on every active, alive server.
    for (const id of ids) {
      const server = L.servers[id];
      if (!isAlive(state, id)) {
        server.depth = 0; // work in a dead box is gone
        continue;
      }
      drainQueue(server, capacity(id), dt, () => {
        spawnPacket(state, `e-${id}`, "response", { speed: 1.1, reverse: true });
      });
      state.nodes[id].load = approach(
        state.nodes[id].load,
        clamp01(server.depth / maxQueue(id)),
        6,
        dt,
      );
    }

    // 4. Readouts.
    const scale = Number(params.scale);
    L.throughput = emaRate(L.throughput, completedNow, dt);
    state.metrics.throughput = L.throughput;
    state.metrics.capacity = alive.reduce((acc, id) => acc + capacity(id), 0);
    state.metrics.dropped = L.droppedTotal;
    // Big iron prices superlinearly; commodity boxes price linearly.
    state.metrics.cost =
      params.mode === "vertical"
        ? Math.round(10 * Math.pow(scale, 1.7))
        : 10 * scale;
  },

  timeline: [
    {
      at: 2,
      caption: "One SCALE slider, two philosophies. Flip between them.",
    },
    {
      at: 9,
      caption:
        "Same total capacity either way. Now check the COST meter as you scale.",
    },
    {
      at: 15,
      caption: "☠ Click a server to kill it. Try this in BOTH modes.",
    },
  ],

  quiz: [
    {
      id: "blast-radius",
      at: 13,
      question:
        "You're at scale 3× and exactly one machine dies. Which mode hurts more?",
      choices: [
        { id: "v", label: "Vertical — you just lost 100% of capacity" },
        { id: "h", label: "Horizontal — more machines, more failures" },
        { id: "same", label: "Same either way: capacity is capacity" },
      ],
      correctChoiceId: "v",
      explain:
        "Vertical scaling concentrates all capacity in one failure domain — one dead box is a total outage. Horizontal keeps serving at 2/3 capacity. This asymmetry, not raw speed, is why the industry defaults to horizontal.",
    },
  ],

  meters: [
    {
      metricKey: "throughput",
      label: "throughput",
      kind: "counter",
      unit: "req/s",
    },
    {
      metricKey: "capacity",
      label: "live capacity",
      kind: "counter",
      unit: "req/s",
    },
    {
      metricKey: "dropped",
      label: "dropped",
      kind: "counter",
      dangerAbove: 0,
    },
    {
      metricKey: "cost",
      label: "cost",
      kind: "counter",
      unit: "$/hr",
    },
  ],
};
