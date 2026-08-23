import {
  advancePackets,
  approach,
  bounceDrop,
  clamp01,
  emaEvent,
  killNode,
  recordSample,
  severEdge,
  shouldSpawn,
  spawnPacket,
} from "@/engine/sim-helpers";
import type { LessonSim, SimState } from "@/engine/types";

/**
 * Lesson — Circuit Breakers. One breaker sits between the clients and svc-1,
 * and the entire lesson is its three-state machine:
 *
 *   CLOSED     forward everything, count *consecutive* failures
 *   OPEN       forward nothing — refuse instantly, for a fixed window
 *   HALF-OPEN  forward exactly `probes` calls; their verdict decides
 *
 * The payoff the lesson is built to make visible is the latency meter. While
 * the breaker is CLOSED and svc-1 is on the floor, every call crawls out and
 * hangs for the full timeout before dying — that is the slow orange column on
 * the stage and the 2000ms plateau on the sparkline. The instant the breaker
 * opens, the same requests bounce off its face and the trace falls to 1ms. A
 * breaker does not make anything work; it makes failing *cheap*.
 *
 * Two authorial notes worth being upfront about:
 *
 * 1. The meter reports modeled wall-clock milliseconds (HEALTHY_MS /
 *    TIMEOUT_MS / FAILFAST_MS), not sim seconds. A 40ms call and a 2s timeout
 *    cannot share one animation timescale — a 40ms call is one tick — so the
 *    stage animates the *shape* of each outcome (a brisk return, a long crawl,
 *    an instant bounce) while the meter reports its cost.
 * 2. Opening the breaker abandons the calls it still had outstanding
 *    (`severEdge`). Their window is over: their verdict no longer moves the
 *    state machine, and leaving them hanging on the wire would keep the meter
 *    reporting a regime the breaker has already left. They die red where the
 *    trip caught them.
 */

/** The three states. `meta.phase` on the breaker node carries it to the figure. */
export type BreakerPhase = "closed" | "open" | "half-open";

/** What the figure draws on the breaker: the state chip and the streak pips. */
export interface BreakerNodeMeta {
  phase: BreakerPhase;
  /** Consecutive failures seen while closed. */
  failStreak: number;
  /** Pips to draw — the live `fail threshold` slider value. */
  threshold: number;
}

interface CBState {
  phase: BreakerPhase;
  failStreak: number;
  /** Sim-seconds at which the current open window expires. */
  openUntil: number;
  /** Probes dispatched / already answered in this half-open window. */
  probesSent: number;
  probesBack: number;
  /**
   * Bumped on every phase change and stamped on every dispatched call. An
   * outcome whose epoch has moved on belongs to a window the breaker has
   * already closed the books on, so it decides nothing — without this, a
   * timeout crawling home from the last outage could re-open a fresh
   * half-open window before its probe ever answered.
   */
  epoch: number;
  trips: number;
  /** Requests refused at the door — the fail-fast count. */
  shed: number;
  /** Calls dispatched to svc-1 and not yet answered. */
  calling: number;
  latencyMs: number;
  /** Observed failure share of the calls that actually reached svc-1. */
  errorPct: number;
}

/** Client load, fixed: the lesson is about the breaker, not the traffic. */
const REQ_RATE = 4;
const IN_SPEED = 1.7;
const OUT_SPEED = 1.6;
/** A hung call crawls home over ~2 sim-seconds — the client's timeout, drawn. */
const TIMEOUT_SPEED = 0.5;

/** Modeled wall-clock cost of each outcome (see the note at the top). */
const HEALTHY_MS = 40;
const TIMEOUT_MS = 2000;
const FAILFAST_MS = 1;

/** Concurrent calls that peg svc-1's load bar. */
const SERVICE_CONCURRENCY = 6;

/* ---------- state-machine transitions ---------- */

function toOpen(
  state: SimState<CBState>,
  openFor: number,
  threshold: number,
): void {
  const L = state.lesson;
  L.phase = "open";
  L.openUntil = state.t + openFor;
  L.trips += 1;
  L.epoch += 1;
  L.probesSent = 0;
  L.probesBack = 0;
  L.calling = 0;
  // Pips stay full through the open window: this is the streak that did it.
  L.failStreak = threshold;
  severEdge(state, "out", "drop");
}

function toHalfOpen(state: SimState<CBState>): void {
  const L = state.lesson;
  L.phase = "half-open";
  L.epoch += 1;
  L.probesSent = 0;
  L.probesBack = 0;
}

function toClosed(state: SimState<CBState>): void {
  const L = state.lesson;
  L.phase = "closed";
  L.epoch += 1;
  L.failStreak = 0;
  L.probesSent = 0;
  L.probesBack = 0;
}

/** One completed call, priced and traced. */
function recordCall(state: SimState<CBState>, ms: number): void {
  state.lesson.latencyMs = emaEvent(state.lesson.latencyMs, ms, 0.45);
  // Raw per-call samples, so the sparkline shows the cliff rather than a curve.
  recordSample(state, "latency", ms);
}

export const circuitBreakerSim: LessonSim<CBState> = {
  id: "circuit-breaker",

  topology: {
    nodes: [
      { id: "client", kind: "client", label: "clients", x: 130, y: 225 },
      { id: "breaker", kind: "loadbalancer", label: "breaker", x: 400, y: 225 },
      {
        id: "svc",
        kind: "server",
        label: "svc-1",
        x: 660,
        y: 225,
        breakable: true,
      },
    ],
    edges: [
      { id: "in", from: "client", to: "breaker" },
      { id: "out", from: "breaker", to: "svc" },
    ],
  },

  params: [
    {
      key: "threshold",
      label: "fail threshold",
      kind: "slider",
      min: 2,
      max: 10,
      step: 1,
      unit: " in a row",
      defaultValue: 4,
    },
    {
      key: "openFor",
      label: "open duration",
      kind: "slider",
      min: 2,
      max: 15,
      step: 1,
      unit: "s",
      defaultValue: 4,
    },
    {
      key: "probes",
      label: "half-open probes",
      kind: "slider",
      min: 1,
      max: 3,
      step: 1,
      defaultValue: 1,
    },
    {
      key: "failRate",
      label: "svc-1 failure rate",
      kind: "slider",
      min: 0,
      max: 60,
      step: 5,
      unit: "%",
      defaultValue: 10,
    },
  ],

  init: () => ({
    phase: "closed",
    failStreak: 0,
    openUntil: 0,
    probesSent: 0,
    probesBack: 0,
    epoch: 0,
    trips: 0,
    shed: 0,
    calling: 0,
    latencyMs: HEALTHY_MS,
    errorPct: 0,
  }),

  step: (state, dt, params) => {
    const L = state.lesson;
    const threshold = Number(params.threshold);
    const openFor = Number(params.openFor);
    const probeBudget = Number(params.probes);
    const failRate = Number(params.failRate) / 100;
    const svc = state.nodes.svc;

    // The open window expires on its own clock — traffic or no traffic.
    if (L.phase === "open" && state.t >= L.openUntil) toHalfOpen(state);

    // Arrivals from the client, at a fixed rate.
    const spawns = shouldSpawn(state, REQ_RATE, dt);
    for (let i = 0; i < spawns; i++) {
      spawnPacket(state, "in", "request", { speed: IN_SPEED });
    }

    for (const p of advancePackets(state, dt)) {
      if (p.edgeId === "in" && !p.reverse) {
        // At the breaker. This branch *is* the circuit breaker.
        const probe = L.phase === "half-open" && L.probesSent < probeBudget;
        if (L.phase === "closed" || probe) {
          if (probe) L.probesSent += 1;
          L.calling += 1;
          spawnPacket(state, "out", probe ? "probe" : "request", {
            speed: OUT_SPEED,
            payload: { epoch: L.epoch },
          });
        } else {
          // OPEN, or half-open with its probe budget already spent: refused
          // at the door, in a millisecond, without touching svc-1.
          L.shed += 1;
          recordCall(state, FAILFAST_MS);
          bounceDrop(state, "in", { type: "limited", speed: 2.2 });
        }
      } else if (
        p.edgeId === "out" &&
        !p.reverse &&
        (p.type === "request" || p.type === "probe")
      ) {
        // At svc-1. "degraded" is the classic half-recovered dependency:
        // the process is back, the requests still error.
        const broken = svc.health !== "healthy";
        const failed = broken || state.rng() < failRate;
        L.errorPct = emaEvent(L.errorPct, failed ? 100 : 0, 0.18);
        // A probe stays violet all the way home so it is followable; an
        // ordinary call comes back green. Either way a failure comes back
        // orange, because a hung call is not a refusal.
        const reply = failed
          ? "timeout"
          : p.type === "probe"
            ? "probe"
            : "response";
        spawnPacket(state, "out", reply, {
          // A failing call does not bounce — it hangs, then dies. That crawl
          // is the cost the breaker exists to stop paying.
          speed: failed ? TIMEOUT_SPEED : OUT_SPEED,
          reverse: true,
          payload: p.payload,
        });
      } else if (
        p.edgeId === "out" &&
        p.reverse &&
        (p.type === "timeout" || p.type === "probe" || p.type === "response")
      ) {
        // The verdict is home — the only place the breaker learns anything.
        if (p.payload?.epoch !== L.epoch) continue; // abandoned window
        L.calling = Math.max(0, L.calling - 1);
        const ok = p.type !== "timeout";
        recordCall(state, ok ? HEALTHY_MS : TIMEOUT_MS);

        if (L.phase === "half-open") {
          // Epoch matched, so this can only be one of our probes.
          L.probesBack += 1;
          if (!ok) toOpen(state, openFor, threshold);
          else if (L.probesBack >= probeBudget) toClosed(state);
        } else if (L.phase === "closed") {
          if (ok) L.failStreak = 0;
          else if (++L.failStreak >= threshold) {
            toOpen(state, openFor, threshold);
          }
        }

        spawnPacket(state, "in", ok ? "response" : "drop", {
          speed: IN_SPEED,
          reverse: true,
          size: ok ? undefined : 3,
        });
      }
      // Reverse packets on "in" have reached the client; severed "drop"s on
      // "out" just fade out. Neither needs handling.
    }

    // Readouts.
    const breaker = state.nodes.breaker;
    breaker.meta = {
      phase: L.phase,
      failStreak: L.failStreak,
      threshold,
    } satisfies BreakerNodeMeta;
    // The breaker's own bar fills with the streak, so it is already amber-red
    // before the chip flips — the trip has a run-up, not just a moment.
    const breakerTarget =
      L.phase === "open"
        ? 1
        : L.phase === "half-open"
          ? 0.55
          : clamp01(L.failStreak / threshold);
    breaker.load = approach(breaker.load, breakerTarget, 8, dt);

    svc.load =
      svc.health === "dead"
        ? 0
        : approach(svc.load, clamp01(L.calling / SERVICE_CONCURRENCY), 6, dt);

    state.metrics.latency = L.latencyMs;
    state.metrics.shed = L.shed;
    state.metrics.trips = L.trips;
    state.metrics.errors = L.errorPct;
  },

  timeline: [
    {
      at: 2,
      caption:
        "CLOSED: the breaker forwards every call and just watches. Green comes back, the pips stay dark.",
    },
    {
      at: 6,
      caption:
        "Those pips count CONSECUTIVE failures. One success wipes them — which is how a real outage gets told apart from ordinary noise.",
    },
    {
      at: 12,
      caption:
        "⚡ svc-1 falls over. Nothing is refused yet: every call still crawls out and hangs for the full timeout before it dies.",
      apply: (s) => killNode(s, "svc"),
    },
    {
      // No clock worth naming — this beat belongs to the trip, whenever the
      // streak actually fills (change the threshold and it moves with you).
      at: 12,
      when: (s) => s.lesson.phase === "open",
      caption:
        "The breaker just opened — clients now fail in 1ms instead of hanging for the timeout. Watch the latency trace fall off a cliff.",
    },
    {
      at: 17,
      caption:
        "svc-1 restarts — up, but still erroring. From out here the breaker cannot tell the difference, so it does nothing but wait out its window.",
      apply: (s) => {
        // Only if the scripted kill still holds: a learner who revived it
        // early keeps their revival.
        if (s.nodes.svc.health === "dead") s.nodes.svc.health = "degraded";
      },
    },
    {
      at: 17,
      when: (s) => s.lesson.phase === "half-open",
      caption:
        "HALF-OPEN: exactly one probe crosses, alone. Every other request still bounces. That single violet dot is the whole trust decision.",
    },
    {
      at: 23,
      caption:
        "svc-1 is genuinely healthy now — and the breaker still doesn't know. Nothing it can see changed; the next probe is what finds out.",
      apply: (s) => {
        if (s.nodes.svc.health === "degraded") s.nodes.svc.health = "healthy";
      },
    },
    {
      at: 25,
      when: (s) => s.lesson.phase === "closed",
      caption:
        "One clean probe and the breaker closes: the full flood is readmitted at once. The whole outage cost two round trips of guessing.",
    },
    {
      at: 32,
      caption:
        "Your turn — click svc-1 to kill it whenever you like, and watch the pips fill, the chip flip, and the latency collapse.",
    },
  ],

  quiz: [
    {
      id: "cb-half-open",
      /*
       * Pinned to seed 42 at the defaults, from headless runs: svc-1 dies at
       * 12.03, the 4th consecutive timeout lands at 14.70 and opens the
       * breaker, the 4s window expires at 18.70 and the first probe leaves in
       * that same tick. svc-1 came back DEGRADED at 17 — up but still erroring
       * — so that probe is doomed before it is sent: it fails at svc-1 around
       * 19.33, and at 20.5 the frame holds exactly two packets — its orange
       * timeout 58% of the way home, and a red refusal bouncing back to a
       * client — under a chip still reading HALF-OPEN. The premise is
       * literally on screen. Resuming re-opens the breaker 0.83s later.
       *
       * Ungated on purpose: this beat belongs to the clock. A learner who has
       * already dragged the sliders has left the script behind, and the
       * question still teaches — but the run they are watching is their own.
       */
      at: 20.5,
      question:
        "The breaker is half-open and its one probe just failed. What happens next?",
      choices: [
        {
          id: "reopen",
          label: "It snaps back to open for another full window — one bad probe is enough",
        },
        {
          id: "retry",
          label: "It stays half-open and keeps probing until one succeeds",
        },
        {
          id: "close",
          label: "It closes anyway — a single request is too small a sample to judge on",
        },
      ],
      correctChoiceId: "reopen",
      explain:
        "Half-open is a one-question interview, and any wrong answer ends it. Staying half-open would leak a fresh probe into a service that is still on fire — a slow trickle of hanging calls instead of an honest stop. Closing would readmit the flood that knocked it over in the first place. So one failure re-opens for the full duration, and production breakers usually grow that duration on each consecutive failed probe (exponential backoff), so a dependency that stays down is asked less and less often.",
    },
  ],

  meters: [
    {
      // The whole lesson in one trace: 40ms, then a 2000ms plateau, then 1ms.
      metricKey: "latency",
      label: "call latency",
      kind: "sparkline",
      unit: " ms",
      decimals: 0,
      dangerAbove: 500,
    },
    {
      metricKey: "shed",
      label: "failed fast",
      kind: "counter",
    },
    {
      metricKey: "trips",
      label: "breaker trips",
      kind: "counter",
      dangerAbove: 0,
    },
    {
      // Only calls that actually reached svc-1 move this — so it freezes while
      // the breaker is open. Blindness is the price of not asking.
      metricKey: "errors",
      label: "svc-1 errors",
      kind: "counter",
      unit: "%",
      decimals: 0,
      dangerAbove: 20,
    },
  ],

  packetStyles: {
    /** The trust decision, crossing alone. */
    probe: { color: "var(--color-glow-violet)", size: 5.5 },
    /** A call that hung and then died — degraded, not refused. */
    timeout: { color: "var(--color-glow-orange)", size: 4 },
  },
};
