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
 *
 * The back half scripts the other half of the story — a surge the consumer
 * cannot outrun, so the buffer runs out of room and the lesson's drops
 * (backpressure) actually happen instead of merely being modelled.
 */

interface MQState {
  /** The buffer between producer and consumer — the whole lesson. */
  queue: ServiceQueue;
  inEma: number;
  outEma: number;
  droppedTotal: number;
  /**
   * Sim-seconds the scripted surge lapses at; 0 (the initial value) means the
   * sliders alone set the rates. Same shape as client-server's burst window.
   */
  surgeUntil: number;
  /** `droppedTotal` when the surge opened — the drain beat waits on the delta. */
  dropsAtSurge: number;
}

const MAX_DEPTH = 40;
/** Scripted surge: the two rates it pins, both at their slider extremes. */
const SURGE_IN = 20;
const SURGE_OUT = 16;
/** How long the surge runs before it lapses and the sliders take back over. */
const SURGE_SECS = 16;
/** Overflow drops the surge must land before the drain beat calls it off. */
const SURGE_DROPS = 8;

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
    surgeUntil: 0,
    dropsAtSurge: 0,
  }),

  step: (state, dt, params) => {
    const L = state.lesson;
    const paused = params.paused === true;

    // Rates. While the scripted surge window is open it holds both sides at
    // the numbers the checkpoint asks about — 20 in against a consumer already
    // flat out at 16 — as a floor, never a ceiling. The window has a hard end
    // (`surgeUntil`), after which the sliders are authoritative again.
    const surging = state.t < L.surgeUntil;
    const produce = surging
      ? Math.max(Number(params.produce), SURGE_IN)
      : Number(params.produce);
    const consume = surging
      ? Math.max(Number(params.consume), SURGE_OUT)
      : Number(params.consume);

    // 1. Producer never stops.
    let producedNow = 0;
    const spawns = shouldSpawn(state, produce, dt);
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
      drainQueue(L.queue, consume, dt, () => {
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
      at: 15.5,
      caption:
        "Un-pause and watch the backlog drain. Delivery lag, not data loss.",
    },
    {
      at: 17,
      caption:
        "⚡ Peak hour: the producer surges to 20 msg/s. The consumer is already flat out at its 16 msg/s ceiling.",
      apply: (s) => {
        s.lesson.surgeUntil = s.t + SURGE_SECS;
        s.lesson.dropsAtSurge = s.lesson.droppedTotal;
      },
    },
    {
      at: 26,
      caption:
        "Surge over — consumer catching up. The backlog drains at (out − in) msg/s.",
      // Waits for the surge to actually overflow — the drain only reads as
      // relief once the learner has watched the queue bounce messages away —
      // and for a consumer that is actually running, or the caption would
      // promise a drain that isn't happening. If neither ever holds, the
      // window still lapses on its own at `surgeUntil`.
      when: (s, params) =>
        params.paused !== true &&
        s.lesson.droppedTotal - s.lesson.dropsAtSurge >= SURGE_DROPS,
      apply: (s) => {
        s.lesson.surgeUntil = 0;
      },
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
    {
      id: "mq-overflow",
      at: 22,
      question: "Producer at 20 msg/s, consumer max 16. What does the queue do?",
      choices: [
        {
          id: "fills",
          label: "Climbs to its 40-deep cap, then drops every new message",
        },
        {
          id: "steady",
          label: "Settles at a steady depth — lag rises, but nothing is lost",
        },
        {
          id: "forever",
          label: "Grows forever — absorbing the difference is what a buffer is for",
        },
      ],
      correctChoiceId: "fills",
      explain:
        "Nothing here throttles the producer, so the surplus is pure accumulation: 20−16 = 4 msg/s into 40 slots fills them in ten seconds, and every arrival after that meets a full queue and bounces. A buffer absorbs bursts, not sustained overload. The only real fixes travel back up the pipe — refuse the write, block the producer, add consumers — and that refusal is backpressure. A bounded queue makes you choose it on purpose; an unbounded one keeps growing until memory chooses for you.",
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
    {
      // The overflow readout: what a full queue costs, in messages.
      metricKey: "dropped",
      label: "dropped",
      kind: "counter",
      dangerAbove: 0,
    },
  ],
};
