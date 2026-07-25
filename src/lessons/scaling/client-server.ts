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
 * Lesson 1 — Client & Server. The reference LessonDef: proves the whole
 * pipeline (packets, meters, params, timeline, prediction quiz).
 *
 * Model (believable, not queueing theory): requests arrive at `rate`,
 * the server works through a bounded queue at `capacity` req/s; the
 * overflow is shed as drops. Click the server to kill it: arrivals bounce,
 * the queue freezes where it stood, and reviving drains the backlog.
 */

interface CSState {
  /** Requests waiting + in service at the server. */
  server: ServiceQueue;
  droppedTotal: number;
  /** Smoothed completions/sec for the throughput meter. */
  throughput: number;
  /** Scripted traffic spike window (set by timeline). */
  burstUntil: number;
  /**
   * Has the learner ever killed the server? Latches true — it gates the
   * closing "click it" invitation, which shouldn't nag someone who already
   * found the gesture.
   */
  everKilled: boolean;
}

const MAX_QUEUE = 24;
const BURST_EXTRA = 18; // req/s added during the scripted spike

export const clientServerSim: LessonSim<CSState> = {
  id: "client-server",

  topology: {
    nodes: [
      { id: "client", kind: "client", label: "browser", x: 160, y: 225 },
      {
        id: "server",
        kind: "server",
        label: "api-1",
        x: 640,
        y: 225,
        breakable: true,
      },
    ],
    edges: [{ id: "wire", from: "client", to: "server" }],
  },

  params: [
    {
      key: "rate",
      label: "arrival rate",
      kind: "slider",
      min: 1,
      max: 30,
      step: 1,
      unit: " req/s",
      defaultValue: 6,
    },
    {
      key: "capacity",
      label: "server speed",
      kind: "slider",
      min: 2,
      max: 25,
      step: 1,
      unit: " req/s",
      defaultValue: 12,
    },
    {
      key: "latency",
      label: "network latency",
      kind: "slider",
      min: 40,
      max: 400,
      step: 20,
      unit: "ms",
      defaultValue: 120,
    },
  ],

  init: () => ({
    server: { depth: 0, acc: 0 },
    droppedTotal: 0,
    throughput: 0,
    burstUntil: 0,
    everKilled: false,
  }),

  step: (state, dt, params) => {
    const L = state.lesson;
    const rate = Number(params.rate);
    const capacity = Number(params.capacity);
    const oneWaySec = Number(params.latency) / 1000;
    const packetSpeed = 1 / oneWaySec;
    // The learner can click the server dead (and back) at any moment.
    const alive = isAlive(state, "server");
    if (!alive) L.everKilled = true;

    // 1. Arrivals (timeline may have opened a burst window).
    const burst = state.t < L.burstUntil ? BURST_EXTRA : 0;
    const spawns = shouldSpawn(state, rate + burst, dt);
    for (let i = 0; i < spawns; i++) {
      spawnPacket(state, "wire", "request", { speed: packetSpeed });
    }

    // 2. Deliveries.
    let completedNow = 0;
    for (const p of advancePackets(state, dt)) {
      if (p.type === "request") {
        // A full queue sheds; a dead box refuses everything. Same visual:
        // a fading red drop bounced back toward the client.
        if (!alive || L.server.depth >= MAX_QUEUE) {
          L.droppedTotal += 1;
          bounceDrop(state, "wire", { speed: packetSpeed * 1.4 });
        } else {
          L.server.depth += 1;
        }
      } else if (p.type === "response") {
        completedNow += 1;
      }
      // drops just fade out on arrival
    }

    // 3. Service: the server works through its queue — unless it is dead.
    // A dead box serves nothing, so the queue freezes exactly where it stood
    // (nothing is lost, nothing moves) until the learner revives it.
    if (alive) {
      drainQueue(L.server, capacity, dt, () => {
        spawnPacket(state, "wire", "response", {
          speed: packetSpeed,
          reverse: true,
        });
      });
    }

    // 4. Readouts.
    L.throughput = emaRate(L.throughput, completedNow, dt);
    const queueWaitMs = (L.server.depth / capacity) * 1000;
    state.metrics.latency = 2 * Number(params.latency) + queueWaitMs;
    state.metrics.throughput = L.throughput;
    state.metrics.queue = L.server.depth;
    state.metrics.dropped = L.droppedTotal;

    // Dead servers do no work: the load bar decays to nothing even though the
    // backlog behind it is still sitting there.
    state.nodes.server.load = approach(
      state.nodes.server.load,
      alive ? clamp01(L.server.depth / MAX_QUEUE) : 0,
      6,
      dt,
    );
    state.nodes.server.queueDepth = L.server.depth;
  },

  timeline: [
    { at: 1.5, caption: "Cyan dots → requests. Green dots ← responses." },
    {
      at: 8,
      caption: "Try it: drag ARRIVAL RATE past SERVER SPEED and watch the queue.",
    },
    {
      at: 14,
      caption: "⚡ A traffic spike hits — 3× normal traffic.",
      apply: (s) => {
        s.lesson.burstUntil = s.t + 6;
      },
    },
    { at: 21.5, caption: "The spike passes. The backlog drains." },
    {
      at: 26,
      caption: "☠ Click the server — watch what a dead box does to its queue.",
      // Skip the invitation if they already found the gesture themselves.
      when: (s) => !s.lesson.everKilled,
    },
    {
      at: 26,
      caption:
        "Dead: every arrival bounces, the queue is frozen. Click it again to revive.",
      // Waits — possibly forever — for the first kill, whenever it lands.
      when: (s) => !isAlive(s, "server"),
    },
  ],

  quiz: [
    {
      id: "cs-queue-growth",
      at: 16.5,
      question:
        "The spike is pushing arrivals past the server's capacity and the queue is growing. If this keeps up, what happens?",
      choices: [
        { id: "a", label: "Latency climbs, then requests start getting dropped" },
        { id: "b", label: "The server automatically speeds up to match" },
        { id: "c", label: "Nothing — queues can absorb any amount of traffic" },
      ],
      correctChoiceId: "a",
      explain:
        "Every request in the queue waits behind the ones before it, so latency grows with queue depth. The queue is bounded (memory isn't free) — once it fills, the only option left is shedding load: drops.",
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
      metricKey: "latency",
      label: "p50 latency",
      kind: "counter",
      unit: "ms",
      dangerAbove: 900,
    },
    {
      metricKey: "queue",
      label: "server queue",
      kind: "bar",
      max: MAX_QUEUE,
      dangerAbove: MAX_QUEUE * 0.8,
    },
    {
      metricKey: "dropped",
      label: "dropped",
      kind: "counter",
      dangerAbove: 0,
    },
  ],
};
