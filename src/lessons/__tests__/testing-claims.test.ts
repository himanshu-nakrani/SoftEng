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
import {
  equivalentMutantsAlgo,
  equivalentMutantsStrengthenedAlgo,
  equivalentMutantsBaseline,
  equivalentMutantFns,
} from "@/lessons/test-quality/equivalent-mutants";
import {
  assertionFreeTestsSmokeAlgo,
  assertionFreeTestsAssertedAlgo,
} from "@/lessons/test-quality/assertion-free-tests";
import {
  brittleMocksMockAlgo,
  brittleMocksStateAlgo,
} from "@/lessons/test-quality/brittle-mocks";
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

// ---------------------------------------------------------------------------
// equivalent-mutants
// ---------------------------------------------------------------------------

describe("equivalent-mutants · the baseline is green and there are five mutants", () => {
  it("passes the unmutated code and tries five mutants per suite", () => {
    // "Five mutants are tried against it, one per row."
    for (const def of [equivalentMutantsAlgo, equivalentMutantsStrengthenedAlgo]) {
      const { state } = run(def);
      expect(state.baselineGreen).toBe(true);
      expect(state.mutants).toHaveLength(5);
    }
  });

  it("runs both suites over the SAME five mutants", () => {
    // "the completed suite below keeps the same five mutants"
    const partial = run(equivalentMutantsAlgo).state.mutants.map((m) => m.id).sort();
    const complete = run(equivalentMutantsStrengthenedAlgo)
      .state.mutants.map((m) => m.id)
      .sort();
    expect(partial).toEqual(complete);
  });
});

describe("equivalent-mutants · the partial suite leaves a mixed grid", () => {
  it("kills two and lets three survive", () => {
    // "The score line reads 2 killed, 3 survived."
    const r = run(equivalentMutantsAlgo);
    expect(r.killed).toBe(2);
    expect(r.survived).toBe(3);
    expect(r.counters[C.killed]).toBe(2);
    expect(r.counters[C.survived]).toBe(3);
  });

  it("the two kills are real holes, both caught by '-20 clamps to 0'", () => {
    // "it checks that ... a negative score clamps to zero" — the negative probe
    // kills the two negative-domain holes.
    const r = run(equivalentMutantsAlgo);
    expect(r.killedIds.sort()).toEqual(
      ["equivalent-mutants-hole-drop-low", "equivalent-mutants-hole-low-val"].sort(),
    );
    expect(r.killedBy("equivalent-mutants-hole-low-val")).toBe("-20 clamps to 0");
    expect(r.killedBy("equivalent-mutants-hole-drop-low")).toBe("-20 clamps to 0");
  });

  it("leaves the two equivalent mutants AND one real hole standing", () => {
    // "Two of those survivors are equivalent mutants ... and the third is a real
    // hole the suite simply never probes."
    expect(run(equivalentMutantsAlgo).survivors.sort()).toEqual(
      [
        "equivalent-mutants-eq-lower-le",
        "equivalent-mutants-eq-upper-ge",
        "equivalent-mutants-hole-high-val",
      ].sort(),
    );
  });

  it("charges ten mutant executions", () => {
    // Two tests over five mutants, stopping at the first failure per mutant:
    // the three survivors run both (6), the two kills stop at the second (4).
    expect(run(equivalentMutantsAlgo).mutantExecutions).toBe(10);
  });

  it("reaches the same verdict on every seed", () => {
    // Rule 6: reseeding reshuffles the narrative but not the verdict.
    for (const seed of [0, 1, 7, 42, 99, 123]) {
      const r = run(equivalentMutantsAlgo, seed);
      expect(r.killed).toBe(2);
      expect(r.survived).toBe(3);
    }
  });
});

describe("equivalent-mutants · completing the suite plateaus on the equivalents", () => {
  it("kills three and lets two survive", () => {
    // "The score line moves to 3 killed, 2 survived."
    const r = run(equivalentMutantsStrengthenedAlgo);
    expect(r.killed).toBe(3);
    expect(r.survived).toBe(2);
    expect(r.counters[C.killed]).toBe(3);
    expect(r.counters[C.survived]).toBe(2);
  });

  it("closes the high-clamp hole with the added '200 clamps to 100' test", () => {
    // "adds one test — a score of 200 clamps to 100 ... The real hole dies."
    const r = run(equivalentMutantsStrengthenedAlgo);
    expect(r.killedBy("equivalent-mutants-hole-high-val")).toBe("200 clamps to 100");
  });

  it("leaves EXACTLY the two equivalent mutants standing", () => {
    // "the two survivors that remain are the two that cannot be killed."
    expect(run(equivalentMutantsStrengthenedAlgo).survivors.sort()).toEqual(
      ["equivalent-mutants-eq-lower-le", "equivalent-mutants-eq-upper-ge"].sort(),
    );
  });

  it("plateaus at three of five — a 60% score", () => {
    // "this suite kills 3 of 5 — a score of 60% — and it is stuck there."
    const r = run(equivalentMutantsStrengthenedAlgo);
    expect(r.killed).toBe(3);
    expect(r.killed + r.survived).toBe(5);
    expect(Math.round((r.killed / (r.killed + r.survived)) * 100)).toBe(60);
  });

  it("reaches the same verdict on every seed", () => {
    for (const seed of [0, 1, 7, 42, 99, 123]) {
      const r = run(equivalentMutantsStrengthenedAlgo, seed);
      expect(r.killed).toBe(3);
      expect(r.survived).toBe(2);
    }
  });
});

describe("equivalent-mutants · the equivalent mutants are genuinely equivalent", () => {
  // "each mutant was diffed against the original over every integer score from
  // -1000 to 2000, and these two matched on every one." No test — not even a
  // perfect one — kills an equivalent mutant, so it survives BOTH suites. These
  // read the SHIPPING baseline and mutant fns, so a break in the def is caught.
  it("agrees with the baseline on every integer score in -1000..2000", () => {
    for (const fn of Object.values(equivalentMutantFns)) {
      for (let score = -1000; score <= 2000; score++) {
        expect(fn(score)).toBe(equivalentMutantsBaseline(score));
      }
    }
  });

  it("survives in BOTH the partial and the completed suite", () => {
    for (const def of [equivalentMutantsAlgo, equivalentMutantsStrengthenedAlgo]) {
      const survivors = run(def).survivors;
      for (const id of Object.keys(equivalentMutantFns)) {
        expect(survivors).toContain(id);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// assertion-free-tests
// ---------------------------------------------------------------------------

describe("assertion-free-tests · smoke suite only catches crashes", () => {
  it("passes the unmutated baseline with 4 smoke tests", () => {
    const r = run(assertionFreeTestsSmokeAlgo);
    expect(r.state.baselineGreen).toBe(true);
    expect(r.state.mutants).toHaveLength(6);
  });

  it("smoke suite kills only the 2 crashing mutants, leaving 4 logic mutants alive", () => {
    const r = run(assertionFreeTestsSmokeAlgo);
    expect(r.killed).toBe(2);
    expect(r.survived).toBe(4);
    expect(r.counters[C.killed]).toBe(2);
    expect(r.counters[C.survived]).toBe(4);
    expect(r.killedIds.sort()).toEqual(
      ["aft-crash-always", "aft-crash-express"].sort(),
    );
    expect(r.survivors.sort()).toEqual(
      [
        "aft-rate-double",
        "aft-surcharge-double",
        "aft-invert-express",
        "aft-always-free",
      ].sort(),
    );
  });

  it("aft-crash-always is killed by standard 5kg", () => {
    const r = run(assertionFreeTestsSmokeAlgo);
    expect(r.killedBy("aft-crash-always")).toBe("smoke: standard 5kg");
  });

  it("aft-crash-express is killed by express 5kg", () => {
    const r = run(assertionFreeTestsSmokeAlgo);
    expect(r.killedBy("aft-crash-express")).toBe("smoke: express 5kg");
  });

  it("smoke suite verdict is identical across seeds", () => {
    for (const seed of [0, 1, 7, 42, 99, 123, 2026]) {
      const r = run(assertionFreeTestsSmokeAlgo, seed);
      expect(r.killed).toBe(2);
      expect(r.survived).toBe(4);
    }
  });
});

describe("assertion-free-tests · asserted suite kills all 6 mutants", () => {
  it("kills all 6 mutants with 0 survivors", () => {
    const r = run(assertionFreeTestsAssertedAlgo);
    expect(r.killed).toBe(6);
    expect(r.survived).toBe(0);
    expect(r.counters[C.killed]).toBe(6);
    expect(r.counters[C.survived] ?? 0).toBe(0);
  });

  it("asserted suite verdict is identical across seeds", () => {
    for (const seed of [0, 1, 7, 42, 99, 123, 2026]) {
      const r = run(assertionFreeTestsAssertedAlgo, seed);
      expect(r.killed).toBe(6);
      expect(r.survived).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// brittle-mocks
// ---------------------------------------------------------------------------

describe("brittle-mocks · mock suite breaks on refactors and sleeps through bugs", () => {
  it("passes the unmutated baseline with 4 spy assertions", () => {
    const r = run(brittleMocksMockAlgo);
    expect(r.state.baselineGreen).toBe(true);
    expect(r.state.mutants).toHaveLength(6);
  });

  it("kills all 3 refactorings while letting all 3 calculation bugs survive", () => {
    const r = run(brittleMocksMockAlgo);
    expect(r.killed).toBe(3);
    expect(r.survived).toBe(3);
    expect(r.counters[C.killed]).toBe(3);
    expect(r.counters[C.survived]).toBe(3);
    expect(r.killedIds.sort()).toEqual(
      [
        "bm-refactor-omit-validate",
        "bm-refactor-batch",
        "bm-refactor-reorder",
      ].sort(),
    );
    expect(r.survivors.sort()).toEqual(
      [
        "bm-bug-subtract",
        "bm-bug-omit-fee",
        "bm-bug-double-fee",
      ].sort(),
    );
  });

  it("mock suite verdict is identical across seeds", () => {
    for (const seed of [0, 1, 7, 42, 99, 123, 2026]) {
      const r = run(brittleMocksMockAlgo, seed);
      expect(r.killed).toBe(3);
      expect(r.survived).toBe(3);
    }
  });
});

describe("brittle-mocks · state verification suite survives refactors and kills bugs", () => {
  it("passes the unmutated baseline with 4 state assertions", () => {
    const r = run(brittleMocksStateAlgo);
    expect(r.state.baselineGreen).toBe(true);
    expect(r.state.mutants).toHaveLength(6);
  });

  it("leaves all 3 refactorings green while killing all 3 calculation bugs", () => {
    const r = run(brittleMocksStateAlgo);
    expect(r.killed).toBe(3);
    expect(r.survived).toBe(3);
    expect(r.counters[C.killed]).toBe(3);
    expect(r.counters[C.survived]).toBe(3);
    expect(r.survivors.sort()).toEqual(
      [
        "bm-refactor-omit-validate",
        "bm-refactor-batch",
        "bm-refactor-reorder",
      ].sort(),
    );
    expect(r.killedIds.sort()).toEqual(
      [
        "bm-bug-subtract",
        "bm-bug-omit-fee",
        "bm-bug-double-fee",
      ].sort(),
    );
  });

  it("state suite verdict is identical across seeds", () => {
    for (const seed of [0, 1, 7, 42, 99, 123, 2026]) {
      const r = run(brittleMocksStateAlgo, seed);
      expect(r.killed).toBe(3);
      expect(r.survived).toBe(3);
    }
  });
});


