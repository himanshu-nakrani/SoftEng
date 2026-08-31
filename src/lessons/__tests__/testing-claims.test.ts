import { buildAlgoSteps } from "@/engine/algo/build";
import { MUTATION_COUNTERS as C } from "@/engine/algo/mutation";
import type { AlgoDef } from "@/engine/algo/types";
import type { MutationState, MutantFrame } from "@/engine/algo/views/mutation";
import {
  coverageVsCorrectnessAlgo,
  coverageVsCorrectnessStrengthenedAlgo,
} from "@/lessons/test-quality/coverage-vs-correctness";
import {
  boundaryMutantsAlgo,
  boundaryMutantsEdgeAlgo,
} from "@/lessons/test-quality/boundary-mutants";
import { describe, expect, it } from "vitest";

/**
 * The test-quality module's prose states numbers. A failure here means a lesson
 * page now lies, and the message should name the sentence that became untrue.
 *
 * Every def is a mutation suite driven through `runMutationSuite`; the seeded
 * mutant order changes the narrative but never the verdict, so these read the
 * final frame. Seed 42 is the harness/figure default, but the verdict is
 * asserted stable across seeds where it matters.
 */

function run<I>(def: AlgoDef<MutationState, I>, seed = 42) {
  const steps = buildAlgoSteps(def, 0, seed);
  const final = steps[steps.length - 1];
  const by = (status: MutantFrame["status"]) =>
    final.state.mutants.filter((m) => m.status === status).map((m) => m.id);
  const killedBy = (id: string) =>
    final.state.mutants.find((m) => m.id === id)?.killedBy;
  return {
    steps,
    state: final.state,
    counters: final.counters,
    killed: final.state.killed,
    survived: final.state.survived,
    survivors: by("survived"),
    killedIds: by("killed"),
    killedBy,
    tests: final.counters[C.tests] ?? 0,
    /** Total test executions charged to mutants (baseline excluded). */
    mutantExecutions: final.state.mutants.reduce((n, m) => n + m.testsRun, 0),
  };
}

// ---------------------------------------------------------------------------
// coverage-vs-correctness
// ---------------------------------------------------------------------------

describe("coverage-vs-correctness · the baseline is green and there are six mutants", () => {
  it("passes the unmutated code and tries six mutants per suite", () => {
    // "Six mutants are then tried against it, one per row of the grid."
    for (const def of [coverageVsCorrectnessAlgo, coverageVsCorrectnessStrengthenedAlgo]) {
      const { state } = run(def);
      expect(state.baselineGreen).toBe(true);
      expect(state.mutants).toHaveLength(6);
    }
  });

  it("runs both suites over the SAME six mutants", () => {
    // "the same six mutants" — the strengthened suite must not have swapped them.
    const weak = run(coverageVsCorrectnessAlgo).state.mutants.map((m) => m.id).sort();
    const strong = run(coverageVsCorrectnessStrengthenedAlgo)
      .state.mutants.map((m) => m.id)
      .sort();
    expect(weak).toEqual(strong);
  });
});

describe("coverage-vs-correctness · the weak suite notices nothing", () => {
  it("kills nothing and lets all six survive", () => {
    // "0 killed, 6 survived. Every row stays red."
    const r = run(coverageVsCorrectnessAlgo);
    expect(r.killed).toBe(0);
    expect(r.survived).toBe(6);
    expect(r.counters[C.killed] ?? 0).toBe(0);
    expect(r.counters[C.survived]).toBe(6);
  });

  it("lets 'always returns B' survive too", () => {
    // "The surprise is always returns B ... It survives too."
    expect(run(coverageVsCorrectnessAlgo).survivors).toContain("cvc-always-b");
  });

  it("reaches the same verdict on every seed", () => {
    // Rule 6: reseeding reshuffles the narrative but not the verdict.
    for (const seed of [0, 1, 7, 42, 99, 123]) {
      const r = run(coverageVsCorrectnessAlgo, seed);
      expect(r.killed).toBe(0);
      expect(r.survived).toBe(6);
    }
  });
});

describe("coverage-vs-correctness · exact assertions kill everything", () => {
  it("kills all six and lets none survive", () => {
    // "6 killed, 0 survived. Every row turned green."
    const r = run(coverageVsCorrectnessStrengthenedAlgo);
    expect(r.killed).toBe(6);
    expect(r.survived).toBe(0);
    expect(r.counters[C.killed]).toBe(6);
    expect(r.counters[C.survived] ?? 0).toBe(0);
  });

  it("kills three of the six with the very first test, '95 is an A'", () => {
    // "Three of the six mutants — including 'always returns B' — are caught by the
    // very first test, 95 is an A."
    const r = run(coverageVsCorrectnessStrengthenedAlgo);
    const byFirst = r.state.mutants.filter((m) => m.killedBy === "95 is an A");
    expect(byFirst).toHaveLength(3);
    expect(r.killedBy("cvc-always-b")).toBe("95 is an A");
  });

  it("reaches the same verdict on every seed", () => {
    for (const seed of [0, 1, 7, 42, 99, 123]) {
      const r = run(coverageVsCorrectnessStrengthenedAlgo, seed);
      expect(r.killed).toBe(6);
      expect(r.survived).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// boundary-mutants
// ---------------------------------------------------------------------------

describe("boundary-mutants · the baseline is green and there are five mutants", () => {
  it("passes the unmutated code and tries five mutants per suite", () => {
    // "Five boundary mutants are tried against it."
    for (const def of [boundaryMutantsAlgo, boundaryMutantsEdgeAlgo]) {
      const { state } = run(def);
      expect(state.baselineGreen).toBe(true);
      expect(state.mutants).toHaveLength(5);
    }
  });

  it("runs both suites over the SAME five mutants", () => {
    // "the same five mutants"
    const far = run(boundaryMutantsAlgo).state.mutants.map((m) => m.id).sort();
    const edge = run(boundaryMutantsEdgeAlgo).state.mutants.map((m) => m.id).sort();
    expect(far).toEqual(edge);
  });
});

describe("boundary-mutants · far inputs let the off-by-ones survive", () => {
  it("kills one and lets four survive", () => {
    // "1 killed, 4 survived."
    const r = run(boundaryMutantsAlgo);
    expect(r.killed).toBe(1);
    expect(r.survived).toBe(4);
    expect(r.counters[C.killed]).toBe(1);
    expect(r.counters[C.survived]).toBe(4);
  });

  it("kills only the coarse mutant, and 'seat 40 invalid' does it", () => {
    // "Only the coarse mutant — the one that drops the upper check entirely —
    // dies, caught by seat 40 invalid."
    const r = run(boundaryMutantsAlgo);
    expect(r.killedIds).toEqual(["boundary-mutants-drop-upper"]);
    expect(r.killedBy("boundary-mutants-drop-upper")).toBe("seat 40 invalid");
  });

  it("leaves exactly the four off-by-one mutants standing", () => {
    // "The four survivors are the true off-by-ones: >= became >, < became <=, and
    // the two bounds shifted by one."
    expect(run(boundaryMutantsAlgo).survivors.sort()).toEqual(
      [
        "boundary-mutants-ge-to-gt",
        "boundary-mutants-lower-off-by-one",
        "boundary-mutants-lt-to-le",
        "boundary-mutants-upper-off-by-one",
      ].sort(),
    );
  });

  it("charges fifteen middle-of-the-range mutant executions", () => {
    // "what fifteen middle-of-the-range executions could not."
    expect(run(boundaryMutantsAlgo).mutantExecutions).toBe(15);
  });

  it("reaches the same verdict on every seed", () => {
    for (const seed of [0, 1, 7, 42, 99, 123]) {
      const r = run(boundaryMutantsAlgo, seed);
      expect(r.killed).toBe(1);
      expect(r.survived).toBe(4);
    }
  });
});

describe("boundary-mutants · edge inputs kill everything", () => {
  it("kills all five and lets none survive", () => {
    // "5 killed, 0 survived."
    const r = run(boundaryMutantsEdgeAlgo);
    expect(r.killed).toBe(5);
    expect(r.survived).toBe(0);
    expect(r.counters[C.killed]).toBe(5);
    expect(r.counters[C.survived] ?? 0).toBe(0);
  });

  it("catches both lower-edge mutants with 'seat 1 valid'", () => {
    // "seat 1 valid catches both lower-edge mutants."
    const r = run(boundaryMutantsEdgeAlgo);
    expect(r.killedBy("boundary-mutants-ge-to-gt")).toBe("seat 1 valid");
    expect(r.killedBy("boundary-mutants-lower-off-by-one")).toBe("seat 1 valid");
  });

  it("catches the upper mutants with 'seat 19 valid' and 'seat 20 invalid'", () => {
    // "seat 19 valid and seat 20 invalid catch the upper ones."
    const r = run(boundaryMutantsEdgeAlgo);
    expect(r.killedBy("boundary-mutants-upper-off-by-one")).toBe("seat 19 valid");
    expect(r.killedBy("boundary-mutants-lt-to-le")).toBe("seat 20 invalid");
  });

  it("reaches the same verdict on every seed", () => {
    for (const seed of [0, 1, 7, 42, 99, 123]) {
      const r = run(boundaryMutantsEdgeAlgo, seed);
      expect(r.killed).toBe(5);
      expect(r.survived).toBe(0);
    }
  });
});
