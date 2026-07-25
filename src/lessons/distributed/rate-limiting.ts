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

/**
 * Lesson 8 — Rate Limiting (token bucket). Tokens refill steadily; each
 * request spends one or bounces 429-red. The BURST button is the exam.
 *
 * Behind the limiter sits api-1 — a small server with a small queue, not
 * scenery. Everything the limiter admits, api-1 has to actually serve, so the
 * two loss counters mean different things: `rejected` is policy (the limiter
 * said no, cheaply, at the door) and `dropped` is capacity (api-1 couldn't
 * cope, or wasn't there at all). Kill api-1 and the punchline lands: the
 * limiter neither knows nor cares, which is precisely why the rate it admits
 * is the rate a recovering server has to survive.
 */

interface RLState {
  tokens: number;
  burstRemaining: number;
  allowedEma: number;
  /** Policy refusals at the limiter — 429s. */
  rejectedTotal: number;
  /** The work api-1 accepted: what the limiter let through. */
  api: ServiceQueue;
  /** Capacity losses at api-1 — queue-full, or a request that hit a corpse. */
  droppedTotal: number;
  /** Sub-tick accumulator for the 10Hz token sparkline. */
  sampleAcc: number;
}

/** api-1 is a small instance — note the refill slider goes higher than this. */
const API_CAPACITY = 8;
/** Its queue is small too: a limiter is not a buffer. */
const API_QUEUE = 12;
/** Requests in one burst, whether the button or the timeline pulls the lever. */
const BURST_SIZE = 30;
/** Sparkline cadence: 10 samples/sec ⇒ the 80-sample window holds ~8s. */
const SAMPLE_INTERVAL = 0.1;

export const rateLimitingSim: LessonSim<RLState> = {
  id: "rate-limiting",

  topology: {
    nodes: [
      { id: "client", kind: "client", label: "clients", x: 130, y: 225 },
      { id: "limiter", kind: "loadbalancer", label: "limiter", x: 400, y: 225 },
      {
        id: "api",
        kind: "server",
        label: "api-1",
        x: 660,
        y: 225,
        breakable: true,
      },
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
    api: { depth: 0, acc: 0 },
    droppedTotal: 0,
    sampleAcc: 0,
  }),

  step: (state, dt, params) => {
    const L = state.lesson;
    const bucket = Number(params.bucket);
    const apiAlive = isAlive(state, "api");

    // Momentary BURST button → 30 extra requests over ~1.5s. The timeline
    // pulls the same lever at t=15, so a learner who never touches the button
    // still sees the spike; the button is there to replay it.
    if (params.burst === true) {
      L.burstRemaining += BURST_SIZE;
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
    let admittedNow = 0;
    for (const p of advancePackets(state, dt)) {
      if (p.edgeId === "in" && p.type === "request") {
        // The limiter's entire decision: is there a token?
        if (L.tokens >= 1) {
          L.tokens -= 1;
          admittedNow += 1;
          spawnPacket(state, "out", "request", { speed: 1.5 });
        } else {
          L.rejectedTotal += 1;
          bounceDrop(state, "in", { type: "limited" });
        }
      } else if (p.edgeId === "out" && p.type === "request") {
        // Admitted — now api-1 has to do the actual work.
        if (!apiAlive || L.api.depth >= API_QUEUE) {
          // A corpse or a full queue: the token was spent either way.
          L.droppedTotal += 1;
          bounceDrop(state, "out");
        } else {
          L.api.depth += 1;
        }
      } else if (p.edgeId === "out" && p.type === "response") {
        spawnPacket(state, "in", "response", { speed: 1.7, reverse: true });
      }
    }

    // 4. Service: api-1 works its queue off at a fixed capacity.
    if (apiAlive) {
      drainQueue(L.api, API_CAPACITY, dt, () => {
        spawnPacket(state, "out", "response", { speed: 1.5, reverse: true });
      });
    } else if (L.api.depth > 0) {
      // Queued work dies with the process — it was never acknowledged.
      L.droppedTotal += L.api.depth;
      L.api.depth = 0;
      L.api.acc = 0;
    }

    // 5. Readouts.
    L.allowedEma = emaRate(L.allowedEma, admittedNow, dt);

    // The bucket lives in the limiter's node overlay (see the figure), so the
    // token count rides in `meta`; the snapshot deep-copies it.
    const limiter = state.nodes.limiter;
    const meta = (limiter.meta ??= {});
    meta.tokens = L.tokens;
    meta.bucket = bucket;
    limiter.load = approach(limiter.load, 1 - clamp01(L.tokens / bucket), 6, dt);

    const api = state.nodes.api;
    api.queueDepth = L.api.depth;
    api.load = apiAlive
      ? approach(api.load, clamp01(L.api.depth / API_QUEUE), 6, dt)
      : 0;

    L.sampleAcc += dt;
    if (L.sampleAcc >= SAMPLE_INTERVAL) {
      L.sampleAcc -= SAMPLE_INTERVAL;
      recordSample(state, "tokens", L.tokens);
    }

    state.metrics.tokens = L.tokens;
    state.metrics.allowed = L.allowedEma;
    state.metrics.rejected = L.rejectedTotal;
    state.metrics.dropped = L.droppedTotal;
  },

  timeline: [
    {
      at: 2,
      caption:
        "The gauge inside the limiter is its bucket. Every forwarded request spends a token.",
    },
    {
      at: 8,
      caption:
        "Requests slower than the refill rate? The bucket stays full — burst headroom.",
    },
    {
      at: 15,
      caption:
        "⚡ 30 requests land at once. The bucket empties, then the red 429s start.",
      apply: (s) => {
        s.lesson.burstRemaining += BURST_SIZE;
      },
    },
    {
      at: 20,
      caption:
        "The spike hit the limiter, not api-1: it got the bucket's worth, then a trickle. Replay with SEND BURST at another bucket size.",
    },
    {
      at: 26,
      caption:
        "Now click api-1 to kill it, and watch what the limiter does about it. (Nothing.)",
    },
    // No `at` worth naming: this one waits for the learner. The gate fires on
    // the first tick api-1 is dead, whenever that is — scripted beat, early
    // click, or ten minutes of fiddling — and then never again.
    {
      at: 0,
      when: (s) => !isAlive(s, "api"),
      caption:
        "☠ api-1 is down — requests bounce off the corpse while the limiter spends tokens as if nothing happened. That cap is what stands between a recovering server and the retry stampede.",
    },
  ],

  quiz: [
    {
      id: "bucket-burst",
      // Half a second before the scripted burst: predict, then watch it land.
      at: 14.5,
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
      kind: "sparkline",
      decimals: 0,
    },
    {
      metricKey: "allowed",
      label: "allowed",
      kind: "counter",
      unit: " req/s",
    },
    {
      // Policy: the limiter said no at the door. Cheap, deliberate, not a fault.
      metricKey: "rejected",
      label: "429 rejected",
      kind: "counter",
    },
    {
      // Capacity: api-1 couldn't take it. This one *is* a fault.
      metricKey: "dropped",
      label: "dropped",
      kind: "counter",
      dangerAbove: 0,
    },
  ],
};
