import {
  advancePackets,
  approach,
  bounceDrop,
  clamp01,
  drainQueue,
  emaRate,
  expirePackets,
  isAlive,
  killNode,
  recordSample,
  reviveNode,
  shouldSpawn,
  spawnPacket,
  type ServiceQueue,
} from "@/engine/sim-helpers";
import type { LessonSim } from "@/engine/types";

/**
 * Lesson — Timeouts & Retries. clients → api-1 → pg-main.
 *
 * Every call api-1 makes to the database carries a deadline (`diesAt`). Miss
 * it and the call is a timeout: the request dies visibly and api-1 schedules a
 * retry under whatever backoff policy the learner picked. That single loop is
 * the whole lesson, because it has a positive feedback term — failure makes
 * load, and load makes failure.
 *
 * The mechanism that turns "slow" into "stuck" is WASTED WORK. pg-main serves
 * its queue FIFO and has no idea the caller walked away, so the head of a long
 * queue is precisely the work nobody is waiting for any more. Past a certain
 * queue depth the database is 100% busy and 0% useful, every call times out,
 * every timeout retries — and the offered load stays above capacity even after
 * the original fault is gone. That is a metastable failure, and the scripted
 * kill/revive at t=14/19 exists to walk the learner straight into one.
 *
 * The exit is not more capacity, it is less load: exponential backoff with
 * jitter spreads the retry backlog until the queue can outrun it.
 */

/** A retry parked until its backoff expires. Deterministic: fired in order. */
interface Waiting {
  dueAt: number;
  /** 1-based: which attempt this will be. Bounded by the max-retries slider. */
  attempt: number;
}

/** One call sitting in pg-main's queue. */
interface Work {
  /** Absolute sim-seconds the caller stops waiting. */
  deadline: number;
  attempt: number;
  /** The caller has already given up; serving this now is pure waste. */
  abandoned: boolean;
}

interface RetryState {
  /** The backoff queue: retries waiting for their turn. */
  waiting: Waiting[];
  /** pg-main's FIFO work queue. */
  queue: Work[];
  dbAcc: number;
  /** req/s the client actually asked for — the amplification denominator. */
  clientEma: number;
  /** req/s offered to pg-main, first tries + retries — the numerator. */
  attemptsEma: number;
  /** req/s of answers that made it home. */
  servedEma: number;
  timeouts: number;
  /** Requests pg-main finished for a caller that had already given up. */
  wasted: number;
  sampleAcc: number;
}

/** Fixed client demand — the point is that this never changes. */
const CLIENT_RATE = 5;
/** pg-main's ceiling. 2.4x the client's demand: there is real headroom here. */
const DB_CAPACITY = 12;
/** Connections it will hold before refusing outright. */
const DB_QUEUE_MAX = 30;

const FRONT_SPEED = 2.2;
const BACK_SPEED = 2.5;
const BOUNCE_SPEED = 2.4;

/** "fixed" backoff: the same pause after every failure. */
const FIXED_DELAY = 0.5;
/** "exp + jitter": window doubles per attempt, then half of it is a coin toss. */
const EXP_BASE = 0.5;
const EXP_CAP = 8;

/**
 * Smoothing for the three rate meters. Slower than the engine default (1.5)
 * because the amplification dial is a *ratio* of two of them: at 30 ticks/sec
 * a single arrival reads as an instantaneous 30 req/s, and a twitchy needle
 * would drown the signal the lesson is built on.
 */
const RATE_EMA = 0.5;

const KILL_AT = 14;
const REVIVE_AT = 19;
/** Sparkline cadence: 10 samples/sec ⇒ the 80-sample window holds ~8s. */
const SAMPLE_INTERVAL = 0.1;

/**
 * How long attempt `attempt` waits before it goes out. Jitter is drawn from
 * the seeded RNG (equal jitter: half the window fixed, half random) so runs
 * stay reproducible — and so retries stop arriving in lockstep, which is the
 * entire reason jitter exists.
 */
function retryDelay(
  policy: string,
  attempt: number,
  rng: () => number,
): number {
  if (policy === "fixed") return FIXED_DELAY;
  if (policy === "exp") {
    const window = Math.min(EXP_BASE * 2 ** (attempt - 1), EXP_CAP);
    return window * (0.5 + rng() * 0.5);
  }
  return 0; // "none" — the naive client, retrying the instant it fails
}

export const retriesTimeoutsSim: LessonSim<RetryState> = {
  id: "retries-timeouts",

  topology: {
    nodes: [
      { id: "client", kind: "client", label: "clients", x: 130, y: 225 },
      { id: "api", kind: "server", label: "api-1", x: 400, y: 225 },
      {
        id: "db",
        kind: "database",
        label: "pg-main",
        x: 660,
        y: 225,
        breakable: true,
      },
    ],
    edges: [
      { id: "front", from: "client", to: "api" },
      { id: "back", from: "api", to: "db" },
    ],
  },

  params: [
    {
      key: "timeout",
      label: "timeout",
      kind: "slider",
      min: 300,
      max: 3000,
      step: 100,
      unit: "ms",
      // A healthy round trip is ~800ms here, so the default leaves api-1 a
      // little under half a second of patience for the queue.
      defaultValue: 1200,
    },
    {
      key: "retries",
      label: "max retries",
      kind: "slider",
      min: 0,
      max: 5,
      step: 1,
      unit: "x",
      defaultValue: 3,
    },
    {
      key: "backoff",
      label: "backoff",
      kind: "select",
      options: [
        { value: "none", label: "none" },
        { value: "fixed", label: "fixed" },
        { value: "exp", label: "exp + jitter" },
      ],
      // Deliberately the naive setting: the scripted outage has to produce the
      // storm unaided. "exp + jitter" is the fix the learner reaches for.
      defaultValue: "none",
    },
    {
      key: "failure",
      label: "db failure rate",
      kind: "slider",
      min: 0,
      max: 50,
      step: 5,
      unit: "%",
      defaultValue: 10,
    },
  ],

  init: () => ({
    waiting: [],
    queue: [],
    dbAcc: 0,
    clientEma: 0,
    attemptsEma: 0,
    servedEma: 0,
    timeouts: 0,
    wasted: 0,
    sampleAcc: 0,
  }),

  step: (state, dt, params) => {
    const L = state.lesson;
    const timeout = Number(params.timeout) / 1000;
    const maxRetries = Number(params.retries);
    const policy = String(params.backoff);
    const failRate = Number(params.failure) / 100;
    const dbUp = isAlive(state, "db");

    // Both amplification terms are counted at the same place — the moment
    // api-1 puts a call on the wire — so in calm traffic the ratio is exactly
    // 1 rather than two smoothed rates chasing each other across the front
    // edge's flight time.
    let firstCount = 0; // calls the client actually asked for
    let attemptCount = 0; // every call pg-main was offered, retries included
    let servedCount = 0; // answers that made it home

    /** Park a retry until its backoff expires — or give up on the call. */
    const scheduleRetry = (attempt: number) => {
      if (attempt >= maxRetries) return; // out of budget: the caller sees an error
      L.waiting.push({
        dueAt: state.t + retryDelay(policy, attempt + 1, state.rng),
        attempt: attempt + 1,
      });
    };

    /** api-1 puts one attempt on the wire, deadline stamped on the packet. */
    const dispatch = (attempt: number) => {
      attemptCount += 1;
      if (attempt === 0) firstCount += 1;
      spawnPacket(state, "back", attempt === 0 ? "request" : "retry", {
        speed: BACK_SPEED,
        diesAt: state.t + timeout,
        payload: { attempt },
      });
    };

    /**
     * A call that died. `from` is where on the edge it turns around (reverse
     * progress), so a request that times out mid-flight visibly gives up where
     * it was rather than teleporting to the database first.
     */
    const failCall = (attempt: number, from = 0) => {
      const bounce = bounceDrop(state, "back", { speed: BOUNCE_SPEED });
      if (bounce) bounce.progress = from;
      scheduleRetry(attempt);
    };

    // 1. Demand. Constant, all lesson long — every other number moves.
    const asks = shouldSpawn(state, CLIENT_RATE, dt);
    for (let i = 0; i < asks; i++) {
      spawnPacket(state, "front", "request", { speed: FRONT_SPEED });
    }

    // 2. Retries whose backoff has expired. With "none" this fires the tick
    //    after the failure — which is exactly the storm's accelerator.
    if (L.waiting.length > 0) {
      const held: Waiting[] = [];
      for (const w of L.waiting) {
        if (state.t >= w.dueAt) dispatch(w.attempt);
        else held.push(w);
      }
      L.waiting = held;
    }

    // 3. Deliveries.
    for (const p of advancePackets(state, dt)) {
      const attempt = Number(p.payload?.attempt ?? 0);

      if (p.edgeId === "front" && p.type === "request") {
        dispatch(0); // at api-1: first attempt at the database
      } else if (p.edgeId === "back" && !p.reverse) {
        // Landed at pg-main. A dead database still swallows the connection and
        // then says nothing — silence is why the timeout is the only way out.
        if (L.queue.length >= DB_QUEUE_MAX) {
          failCall(attempt); // queue full: a fast, honest refusal
        } else {
          L.queue.push({
            deadline: p.diesAt ?? state.t + timeout,
            attempt,
            abandoned: false,
          });
        }
      } else if (p.edgeId === "back" && p.type === "response") {
        spawnPacket(state, "front", "response", {
          speed: FRONT_SPEED,
          reverse: true,
        });
      } else if (p.edgeId === "front" && p.type === "response") {
        servedCount += 1;
      }
    }

    // 4. Timeouts in flight: the deadline passed before the request even
    //    landed. Set the timeout under the round trip and this is every call.
    for (const p of expirePackets(state)) {
      L.timeouts += 1;
      failCall(Number(p.payload?.attempt ?? 0), 1 - p.progress);
    }

    // 5. Timeouts in the queue: api-1 gave up on a call pg-main still holds.
    for (const w of L.queue) {
      if (w.abandoned || state.t < w.deadline) continue;
      L.timeouts += 1;
      failCall(w.attempt);
      w.abandoned = true;
    }
    // A live database has no idea the caller left: the work stays queued and
    // will be done anyway. A dead one loses its queue with the process.
    if (!dbUp) L.queue = L.queue.filter((w) => !w.abandoned);

    // 6. Service. FIFO, so the head of a deep queue is the oldest call — and
    //    the oldest call is the one most likely already abandoned.
    if (dbUp) {
      const q: ServiceQueue = { depth: L.queue.length, acc: L.dbAcc };
      drainQueue(q, DB_CAPACITY, dt, () => {
        const w = L.queue.shift()!;
        if (w.abandoned) {
          L.wasted += 1; // 100% busy, 0% useful
          return;
        }
        if (state.rng() < failRate) {
          failCall(w.attempt);
          return;
        }
        spawnPacket(state, "back", "response", {
          speed: BACK_SPEED,
          reverse: true,
        });
      });
      L.dbAcc = q.acc;
    }

    // 7. Readouts.
    L.clientEma = emaRate(L.clientEma, firstCount, dt, RATE_EMA);
    L.attemptsEma = emaRate(L.attemptsEma, attemptCount, dt, RATE_EMA);
    L.servedEma = emaRate(L.servedEma, servedCount, dt, RATE_EMA);

    // The lesson in one number: what pg-main is offered ÷ what anyone asked
    // for. Held at 1 until the denominator is real (both start at zero).
    const amplification =
      L.clientEma >= 1 ? Math.min(L.attemptsEma / L.clientEma, 9) : 1;

    const api = state.nodes.api;
    api.queueDepth = L.waiting.length; // retries holding, not yet fired
    api.load = approach(
      api.load,
      clamp01(L.attemptsEma / (CLIENT_RATE * 4)),
      6,
      dt,
    );

    const db = state.nodes.db;
    db.queueDepth = L.queue.length;
    db.load = dbUp
      ? approach(db.load, clamp01(L.queue.length / DB_QUEUE_MAX), 6, dt)
      : 0;

    L.sampleAcc += dt;
    if (L.sampleAcc >= SAMPLE_INTERVAL) {
      L.sampleAcc -= SAMPLE_INTERVAL;
      recordSample(state, "attempts", L.attemptsEma);
    }

    state.metrics.amplification = amplification;
    state.metrics.attempts = L.attemptsEma;
    state.metrics.served = L.servedEma;
    state.metrics.timeouts = L.timeouts;
    state.metrics.wasted = L.wasted;
  },

  timeline: [
    {
      at: 2,
      caption:
        "Amber dots are requests. Every call api-1 makes to pg-main carries a deadline — that is the TIMEOUT slider.",
    },
    {
      at: 8,
      caption:
        "Some calls come back red — pg-main erroring, or the deadline running out. Either way api-1 sends an orange retry: load nobody asked for.",
    },
    {
      at: KILL_AT,
      caption:
        "☠ pg-main stops answering. It does not refuse — it goes quiet, so every call waits out the full timeout, then retries.",
      apply: (s) => killNode(s, "db"),
    },
    {
      at: REVIVE_AT,
      caption: "pg-main is back — watch what the retries do.",
      apply: (s) => reviveNode(s, "db"),
    },
    // No scripted moment: this one waits for the storm to actually exist. With
    // backoff on, the condition never holds and the caption never fires.
    {
      at: 24,
      when: (s) => isAlive(s, "db") && s.metrics.amplification > 2,
      caption:
        "pg-main is healthy and the dial still reads far above 1x — every real request is dragging a crowd of shadows behind it. This is the storm, and it is now feeding itself.",
    },
    {
      at: 28,
      caption:
        "Replay the outage on each BACKOFF setting: none hammers, fixed keeps the retries in lockstep, exp + jitter spreads them until the queue can drain.",
    },
  ],

  quiz: [
    {
      id: "rt-timeout-floor",
      at: 11,
      question:
        "You drag TIMEOUT below the time a healthy round trip takes. What does api-1 see?",
      choices: [
        {
          id: "all-fail",
          label: "Every call times out and retries — load with no successes",
        },
        { id: "slow-fail", label: "Slow calls fail; fast ones still get through" },
        {
          id: "no-change",
          label: "Nothing changes — the timeout only matters when pg-main is down",
        },
      ],
      correctChoiceId: "all-fail",
      explain:
        "A deadline shorter than the round trip cannot be met by anything. Every call fails at the deadline, every failure retries, and pg-main ends up doing strictly more work than before — none of it useful. A timeout belongs just above the latency you actually expect (p99 plus a margin), never below it.",
    },
    {
      id: "rt-metastable",
      // Half a second after the revive: predict, then watch the resumed sim
      // refuse to recover.
      at: REVIVE_AT + 0.5,
      question: "The database just came back up. Does load return to normal?",
      choices: [
        { id: "yes", label: "Yes — the fault is gone, so traffic returns to baseline" },
        {
          id: "decay",
          label: "It halves immediately, then decays smoothly back to normal",
        },
        {
          id: "no",
          label:
            "No — the retry backlog keeps it saturated; only backoff lets it drain",
        },
      ],
      correctChoiceId: "no",
      explain:
        "This is a metastable failure. The client is still asking for the same rate it always did, but every request is now spending its whole retry budget, so pg-main is offered several times that. Worse, it is serving from the front of a queue so old that the callers already left — watch the wasted counter. The trigger is gone and the system stays down, because the retries have become the load. The only exit is cutting the offered rate: backoff, jitter, and a retry budget.",
    },
  ],

  meters: [
    {
      // THE meter: downstream req/s ÷ client req/s.
      metricKey: "amplification",
      label: "amplification",
      kind: "gauge",
      max: 6,
      unit: "x",
      decimals: 1,
      dangerAbove: 2,
    },
    {
      metricKey: "attempts",
      label: "offered load",
      kind: "sparkline",
      unit: " req/s",
      dangerAbove: DB_CAPACITY,
    },
    {
      metricKey: "served",
      label: "served",
      kind: "counter",
      unit: " req/s",
      decimals: 1,
      dangerBelow: 1,
    },
    {
      metricKey: "timeouts",
      label: "timeouts",
      kind: "counter",
      dangerAbove: 0,
    },
    {
      // Work pg-main finished for callers who had already given up.
      metricKey: "wasted",
      label: "wasted work",
      kind: "counter",
      dangerAbove: 0,
    },
  ],

  packetStyles: {
    // Retries wear the warning hue, so the share of the api→db edge that is
    // traffic nobody asked for is readable at a glance.
    retry: { color: "var(--color-glow-orange)", size: 4.5 },
  },
};
