import {
  advancePackets,
  approach,
  bounceDrop,
  clamp01,
  drainQueue,
  emaRate,
  shouldSpawn,
  spawnPacket,
  type ServiceQueue,
} from "@/engine/sim-helpers";
import type { LessonSim } from "@/engine/types";

/**
 * Lesson 9 — Message Queues & Backpressure. Producer races consumer with a
 * buffer between them. The PAUSE CONSUMER toggle is the whole lesson:
 * the queue absorbs the outage, then drains.
 */

interface MQState {
  /** The buffer between producer and consumer — the whole lesson. */
  queue: ServiceQueue;
  inEma: number;
  outEma: number;
  droppedTotal: number;
}

const MAX_DEPTH = 40;

export const messageQueuesSim: LessonSim<MQState> = {
  id: "message-queues",

  topology: {
    nodes: [
      { id: "producer", kind: "client", label: "producer", x: 130, y: 225 },
      { id: "queue", kind: "queue", label: "orders-q", x: 400, y: 225 },
      { id: "consumer", kind: "server", label: "worker-1", x: 660, y: 225 },
    ],
    edges: [
      { id: "in", from: "producer", to: "queue" },
      { id: "out", from: "queue", to: "consumer" },
    ],
  },

  params: [
    {
      key: "produce",
      label: "producer rate",
      kind: "slider",
      min: 1,
      max: 20,
      step: 1,
      unit: " msg/s",
      defaultValue: 6,
    },
    {
      key: "consume",
      label: "consumer rate",
      kind: "slider",
      min: 1,
      max: 16,
      step: 1,
      unit: " msg/s",
      defaultValue: 8,
    },
    {
      key: "paused",
      label: "pause consumer",
      kind: "toggle",
      defaultValue: false,
    },
  ],

  init: () => ({
    queue: { depth: 0, acc: 0 },
    inEma: 0,
    outEma: 0,
    droppedTotal: 0,
  }),

  step: (state, dt, params) => {
    const L = state.lesson;
    const paused = params.paused === true;

    // 1. Producer never stops.
    let producedNow = 0;
    const spawns = shouldSpawn(state, Number(params.produce), dt);
    for (let i = 0; i < spawns; i++) {
      producedNow += 1;
      spawnPacket(state, "in", "write", { speed: 1.6 });
    }

    // 2. Deliveries.
    let consumedNow = 0;
    for (const p of advancePackets(state, dt)) {
      if (p.edgeId === "in" && p.type === "write") {
        if (L.queue.depth >= MAX_DEPTH) {
          // Queue full — the backpressure moment.
          L.droppedTotal += 1;
          bounceDrop(state, "in");
        } else {
          L.queue.depth += 1;
        }
      } else if (p.edgeId === "out" && p.type === "write") {
        consumedNow += 1;
        spawnPacket(state, "out", "response", {
          speed: 1.4,
          reverse: true,
          size: 3,
        });
      }
    }

    // 3. Consumer pulls (unless deploying…).
    if (!paused) {
      drainQueue(L.queue, Number(params.consume), dt, () => {
        spawnPacket(state, "out", "write", { speed: 1.4 });
      });
    }

    // 4. Readouts.
    const depth = L.queue.depth;
    L.inEma = emaRate(L.inEma, producedNow, dt);
    L.outEma = emaRate(L.outEma, consumedNow, dt);
    state.nodes.queue.queueDepth = depth;
    state.nodes.queue.load = approach(
      state.nodes.queue.load,
      clamp01(depth / MAX_DEPTH),
      6,
      dt,
    );
    state.nodes.consumer.health = paused ? "degraded" : "healthy";
    state.metrics.depth = depth;
    state.metrics.inRate = L.inEma;
    state.metrics.outRate = L.outEma;
    state.metrics.lagSec = L.outEma > 0.5 ? depth / L.outEma : depth;
    state.metrics.dropped = L.droppedTotal;
  },

  timeline: [
    {
      at: 2,
      caption:
        "Producer and consumer never talk directly — the queue decouples their fates.",
    },
    {
      at: 8,
      caption:
        "Flip PAUSE CONSUMER — deploy time. The producer doesn't notice. That's the point.",
    },
    {
      at: 18,
      caption:
        "Un-pause and watch the backlog drain. Delivery lag, not data loss.",
    },
  ],

  quiz: [
    {
      id: "mq-backlog",
      at: 14,
      question:
        "Producer at 8 msg/s, consumer paused for 30s (240 queued), then resumes at 12 msg/s. What happens to the backlog?",
      choices: [
        {
          id: "drain",
          label: "It drains at 4 msg/s net — a minute of extra latency, nothing lost",
        },
        { id: "lost", label: "The 240 messages are lost — queues aren't storage" },
        { id: "instant", label: "It clears instantly once the consumer returns" },
      ],
      correctChoiceId: "drain",
      explain:
        "Consumption exceeds production by 12−8 = 4 msg/s, so 240 messages take ~60s to work off. The outage became latency instead of loss — the entire value proposition of a queue, provided the backlog fits and the drain rate is positive.",
    },
  ],

  meters: [
    {
      metricKey: "depth",
      label: "queue depth",
      kind: "bar",
      max: MAX_DEPTH,
      dangerAbove: MAX_DEPTH * 0.75,
    },
    {
      metricKey: "inRate",
      label: "in",
      kind: "counter",
      unit: " msg/s",
    },
    {
      metricKey: "outRate",
      label: "out",
      kind: "counter",
      unit: " msg/s",
    },
    {
      metricKey: "lagSec",
      label: "delivery lag",
      kind: "counter",
      unit: "s",
      decimals: 1,
      dangerAbove: 20,
    },
  ],
};
