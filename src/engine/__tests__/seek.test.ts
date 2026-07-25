/**
 * Seeking is replay — this file is the proof.
 *
 * `SimRunner.seekTo(t)` keeps no history: it rebuilds the initial state from
 * the seed and re-ticks to `t`. That is only a legitimate scrubber if the
 * rebuilt world is INDISTINGUISHABLE from the world a straight run produces —
 * so every assertion here compares a sought runner against a virgin one over
 * `projectForDeterminism` (metrics, packets with payloads, nextPacketId, node
 * health/load/queue, series), the same projection the determinism suite pins.
 *
 * Sims are pulled from the shared harness map rather than imported directly,
 * so this file rides the same "one line in SIM_BY_KEY" contract as the rest of
 * the suite. Four are exercised, chosen for structurally different engines:
 * a queue (client-server), a partition/timeline-heavy sim (cap-theorem), an
 * RNG-heavy elected-leader sim (leader-election), and one whose beats are
 * mostly `when`-gated (cache-stampede).
 */

import { describe, expect, it } from "vitest";

import { createRunner, SEEK_LIMIT, type SimRunner } from "@/engine/runner";
import type {
  ScrubCheckpoint,
  ScrubEvent,
} from "@/engine/components/TransportBar";
import type { LessonSim } from "@/engine/types";
import { clientServerSim } from "@/lessons/scaling/client-server";

import {
  GOLDEN_SEED,
  RUN_TO,
  lessonsUnderTest,
  projectForDeterminism,
  ungatedQuizzes,
} from "./harness";

/** Mid-run moments to land on: before, between and after most scripted beats. */
const SEEK_TARGETS = [5, 12.5, 22];

const SEEK_KEYS = [
  "scaling/client-server",
  "distributed/cap-theorem",
  "distributed/leader-election",
  "data/cache-stampede",
];

function simFor(key: string): LessonSim<unknown> {
  const entry = lessonsUnderTest.find((l) => l.key === key);
  if (!entry) {
    throw new Error(
      `seek.test: no available lesson "${key}" in the harness map. ` +
        "If the lesson was renamed or retired, pick another representative sim.",
    );
  }
  return entry.sim;
}

const fresh = (sim: LessonSim<unknown>): SimRunner =>
  createRunner(sim, { seed: GOLDEN_SEED });

/** Everything a viewer can observe, at a moment. */
const observe = (runner: SimRunner) => ({
  state: projectForDeterminism(runner.state),
  caption: runner.caption,
});

/** A virgin runner driven straight to `t` — the thing a seek must reproduce. */
function ranTo(sim: LessonSim<unknown>, t: number) {
  const runner = fresh(sim);
  runner.runTo(t);
  return observe(runner);
}

describe.each(SEEK_KEYS)("seekTo — %s", (key) => {
  const sim = simFor(key);

  it.each(SEEK_TARGETS)(
    "rewinding from t=%s… lands exactly on a straight run",
    (target) => {
      const runner = fresh(sim);
      runner.runTo(RUN_TO);
      runner.seekTo(target);

      expect(observe(runner)).toEqual(ranTo(sim, target));
    },
  );

  it("seeking forward past the furthest tick equals running there", () => {
    const runner = fresh(sim);
    runner.runTo(5);
    runner.seekTo(22);

    expect(observe(runner)).toEqual(ranTo(sim, 22));
  });

  it("seekTo(0) restores a brand-new runner", () => {
    const runner = fresh(sim);
    runner.runTo(RUN_TO);
    runner.seekTo(0);

    expect(observe(runner)).toEqual(observe(fresh(sim)));
    expect(runner.state.t).toBe(0);
  });

  it("playing on from a seek stays on the canonical timeline", () => {
    const runner = fresh(sim);
    runner.runTo(RUN_TO);
    runner.seekTo(12.5);
    runner.runTo(RUN_TO);

    expect(observe(runner)).toEqual(ranTo(sim, RUN_TO));
  });

  it("replaces the state object, as restart does", () => {
    const runner = fresh(sim);
    const before = runner.state;
    runner.runTo(10);
    runner.seekTo(3);

    // The hook re-points its live ref on the strength of this; PacketLayer
    // would otherwise keep drawing the abandoned world.
    expect(runner.state).not.toBe(before);
  });
});

describe("seekTo — quiz checkpoints", () => {
  // Checkpoints crossed by a replay are marked fired and their results
  // dropped, so a scrub never pops an overlay. The cost is stated in the API
  // doc: scrubbing past an unanswered checkpoint forfeits it for the run.
  const withQuiz = SEEK_KEYS.map((key) => ({
    key,
    sim: simFor(key),
  })).filter(({ sim }) => ungatedQuizzes(sim).length > 0);

  it("covers at least one sim with an ungated checkpoint", () => {
    expect(withQuiz.length).toBeGreaterThan(0);
  });

  it.each(withQuiz)("$key — a seek past a checkpoint forfeits it", ({ sim }) => {
    const quiz = ungatedQuizzes(sim)[0];
    const runner = fresh(sim);

    // It fires on a straight run…
    const played = runner.runTo(quiz.at + 1);
    expect(played.some((r) => r.firedQuiz?.id === quiz.id)).toBe(true);

    // …but a seek that crosses it swallows it, and it never comes back.
    runner.seekTo(0);
    runner.seekTo(quiz.at + 1);
    const after = runner.runTo(RUN_TO);
    expect(after.some((r) => r.firedQuiz?.id === quiz.id)).toBe(false);
  });

  it.each(withQuiz)("$key — seeking back before it restores it", ({ sim }) => {
    const quiz = ungatedQuizzes(sim)[0];
    const runner = fresh(sim);
    runner.runTo(RUN_TO);

    runner.seekTo(Math.max(0, quiz.at - 1));
    const replayed = runner.runTo(quiz.at + 1);
    expect(replayed.some((r) => r.firedQuiz?.id === quiz.id)).toBe(true);
  });
});

describe("seekTo — params are the current ones", () => {
  const sim = simFor("scaling/client-server");

  it("replays the past under the params as they are NOW", () => {
    const runner = fresh(sim);
    runner.runTo(RUN_TO);
    // The learner drags ARRIVAL RATE up, then scrubs back to t=10.
    runner.setParam("rate", 24);
    runner.seekTo(10);

    // The replayed past is the deterministic what-if, not the run that was
    // watched: identical to having started with that slider position…
    const whatIf = createRunner(sim, {
      seed: GOLDEN_SEED,
      params: { rate: 24 },
    });
    whatIf.runTo(10);
    expect(projectForDeterminism(runner.state)).toEqual(
      projectForDeterminism(whatIf.state),
    );

    // …and demonstrably NOT the default-param history it replaced.
    expect(projectForDeterminism(runner.state)).not.toEqual(
      ranTo(sim, 10).state,
    );
  });

  it("leaves the params themselves alone", () => {
    const runner = fresh(sim);
    runner.setParam("rate", 24);
    runner.seekTo(4);
    expect(runner.params.rate).toBe(24);
  });
});

describe("scrub-track markers", () => {
  /**
   * Type-only guard, checked by `tsc` rather than at runtime: the transport
   * bar's marker props must accept a CONCRETE lesson's arrays. `TimelineEvent`
   * and `QuizCheckpoint` are contravariant in the lesson state, so the sim is
   * imported directly here — the harness widens everything to
   * `LessonSim<unknown>`, which would hide exactly the assignability this
   * pins. (The imports are erased: nothing React-shaped runs in node.)
   */
  it("accept a lesson's timeline and quiz arrays unchanged", () => {
    const timeline: readonly ScrubEvent[] | undefined = clientServerSim.timeline;
    const quiz: readonly ScrubCheckpoint[] | undefined = clientServerSim.quiz;

    expect(timeline?.length).toBeGreaterThan(0);
    expect(quiz?.length).toBeGreaterThan(0);
  });
});

describe("seekTo — guards", () => {
  const sim = simFor("scaling/client-server");

  it("clamps a negative target to zero", () => {
    const runner = fresh(sim);
    runner.runTo(10);
    runner.seekTo(-5);
    expect(observe(runner)).toEqual(observe(fresh(sim)));
  });

  it("ignores a non-finite target", () => {
    const runner = fresh(sim);
    runner.runTo(10);
    const before = observe(runner);
    runner.seekTo(Number.NaN);
    runner.seekTo(Number.POSITIVE_INFINITY);
    expect(observe(runner)).toEqual(before);
  });

  it("clamps an absurd target to SEEK_LIMIT instead of looping forever", () => {
    const runner = fresh(sim);
    runner.seekTo(1e9);
    expect(runner.state.t).toBeGreaterThanOrEqual(SEEK_LIMIT);
    expect(runner.state.t).toBeLessThan(SEEK_LIMIT + 1);
  });
});
