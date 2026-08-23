import {
  advancePackets,
  approach,
  bounceDrop,
  clamp01,
  drainQueue,
  emaRate,
  isAlive,
  killNode,
  reviveNode,
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
  /**
   * Ids the live mode/scale has provisioned, refreshed every step. Timeline
   * `apply` callbacks only receive state — never params — so this is how the
   * scripted failure finds the topology the learner is actually running.
   */
  activeIds: string[];
  /**
   * Who the scripted failure took. Remembered so the revive puts back exactly
   * that box and never resurrects one the learner killed themselves.
   */
  scriptedVictim: string | null;
  /**
   * Sim-time the scripted failure actually landed. The revive keys off this
   * rather than its own `at`, so the corpse always gets its full window even
   * when the death's gate held it back.
   */
  scriptedDeathAt: number | null;
}

const UNIT_CAPACITY = 6; // req/s per "1×" of scale
const MAX_QUEUE_PER_UNIT = 10;
/** Sim-seconds the scripted corpse stays down — one full caption. */
const OUTAGE_WINDOW = 4;
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
    activeIds: ["xl"],
    scriptedVictim: null,
    scriptedDeathAt: null,
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
    // Publish the live fleet for the timeline's scripted failure to aim at.
    L.activeIds = ids;

    const alive = ids.filter((id) => isAlive(state, id));

    // 1. Arrivals — spread evenly across alive servers (the naive
    //    "even spread"; the real traffic cop arrives next lesson).
    const spawns = shouldSpawn(state, Number(params.rate), dt);
    for (let i = 0; i < spawns; i++) {
      if (alive.length === 0) {
        // Total outage: everything bounces.
        L.droppedTotal += 1;
        bounceDrop(state, `e-${ids[0] ?? "xl"}`);
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
          bounceDrop(state, p.edgeId);
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

  workbench: {
    experiment: {
      id: "compare-failure-domains",
      title: "Compare the failure domain",
      prompt:
        "Start the system, then switch between one large machine and a small fleet before the scripted failure arrives.",
      actionLabel: "Start comparison",
      focusId: "same-capacity",
      action: { kind: "play" },
    },
    focuses: [
      {
        id: "same-capacity",
        label: "Same capacity, different shape",
        phase: "baseline",
        at: 2,
        nodes: ["client", "xl", "h1", "h2", "h3", "h4"],
        edges: ["e-xl", "e-h1", "e-h2", "e-h3", "e-h4"],
        metrics: ["throughput", "capacity", "cost"],
        summary:
          "Vertical and horizontal modes can begin with the same total capacity; the important distinction is where that capacity is concentrated.",
        nextAction: "Switch strategy before the failure beat and compare the live-capacity meter.",
      },
      {
        id: "cost-shape",
        label: "Capacity changes its price",
        phase: "change",
        at: 9,
        nodes: ["client", "xl", "h1", "h2", "h3", "h4"],
        edges: ["e-xl", "e-h1", "e-h2", "e-h3", "e-h4"],
        metrics: ["capacity", "cost"],
        summary:
          "The scale control changes available capacity, while the selected strategy determines the cost and operational shape used to provide it.",
        nextAction: "Increase scale once in each mode and compare cost before looking at throughput.",
        trigger: { kind: "param-change", id: "mode" },
      },
      {
        id: "failure-domain",
        label: "One failure removes a different share",
        phase: "impact",
        at: 15,
        nodes: ["client", "xl", "h1", "h2", "h3", "h4"],
        edges: ["e-xl", "e-h1", "e-h2", "e-h3", "e-h4"],
        metrics: ["capacity", "throughput", "dropped"],
        summary:
          "A single machine failure removes all capacity when it is concentrated, but only one slice when the same capacity is distributed across a fleet.",
        nextAction: "Pause here and use live capacity to state the blast radius before resuming.",
      },
      {
        id: "fleet-restored",
        label: "Restore, then test deliberately",
        phase: "resolution",
        at: 21,
        nodes: ["client", "xl", "h1", "h2", "h3", "h4"],
        metrics: ["capacity", "throughput", "dropped"],
        summary:
          "The scripted node returns so the system can recover; resilience is then a property the learner can test intentionally in both strategies.",
        nextAction: "Kill one live node yourself in each mode and compare the recovery story.",
      },
    ],
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
      // The proof the quiz just asked for: a machine dies on its own, in
      // whichever fleet the learner happens to be running. `apply` never sees
      // params, so it aims at `activeIds`, which step republishes every tick.
      // The gate covers the learner who has already clicked the fleet dead —
      // the beat waits for something to actually kill rather than lying.
      at: 15,
      when: (s) => s.lesson.activeIds.some((id) => isAlive(s, id)),
      caption:
        "☠ One machine just died — watch LIVE CAPACITY. This is the failure-domain difference.",
      apply: (s) => {
        const live = s.lesson.activeIds.filter((id) => isAlive(s, id));
        const victim = live[live.length - 1]; // `when` guarantees one exists
        if (!victim) return;
        killNode(s, victim);
        s.lesson.scriptedVictim = victim;
        s.lesson.scriptedDeathAt = s.t;
      },
    },
    {
      // Hand the fleet back intact: a corpse left standing would follow the
      // learner through the rest of the lesson (health survives mode flips,
      // and an out-of-mode box renders as a ghost, hiding the corpse until it
      // silently zeroes capacity on the way back). The gate measures from the
      // death rather than from this `at`, so a failure the gate above held
      // back still gets its full window instead of being undone the same tick.
      at: 15 + OUTAGE_WINDOW,
      when: (s) =>
        s.lesson.scriptedDeathAt !== null &&
        s.t >= s.lesson.scriptedDeathAt + OUTAGE_WINDOW,
      caption:
        "…and it's back. Now do it yourself: kill a box in BOTH modes and compare.",
      apply: (s) => {
        if (s.lesson.scriptedVictim) reviveNode(s, s.lesson.scriptedVictim);
        s.lesson.scriptedVictim = null;
      },
    },
  ],

  quiz: [
    {
      // Premise is self-contained (it names both shapes) so it stays true at
      // any slider position; the scripted death two seconds later shows the
      // learner whichever half of the answer their current mode lives in.
      id: "blast-radius",
      at: 13,
      question:
        "Same total capacity, two shapes: one 4× machine, or four 1× machines. In a moment, exactly one machine dies. Which shape hurts more?",
      choices: [
        {
          id: "v",
          label: "Vertical — the one big box IS the fleet: capacity → 0",
        },
        { id: "h", label: "Horizontal — more machines, more things to fail" },
        { id: "same", label: "Same either way: capacity is capacity" },
      ],
      correctChoiceId: "v",
      explain:
        "Vertical concentrates every request into one failure domain, so one dead box is a total outage — live capacity 0. Horizontal loses a slice: three of four machines keep serving at 75%. More machines really do fail more often; each failure just costs a fraction instead of everything. Watch — one of your machines is about to die.",
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
