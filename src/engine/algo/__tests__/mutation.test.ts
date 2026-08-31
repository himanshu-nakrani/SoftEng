import { buildAlgoSteps } from "@/engine/algo/build";
import {
  MUTATION_COUNTERS,
  runMutationSuite,
  type MutationSuite,
} from "@/engine/algo/mutation";
import { mulberry32 } from "@/engine/rng";
import type { AlgoDef } from "@/engine/algo/types";
import { MutationView } from "@/engine/algo/views/MutationView";
import type { MutationState } from "@/engine/algo/views/mutation";
import type { ComponentType } from "react";
import { describe, expect, it } from "vitest";

/**
 * Archetype D — the test/mutation harness.
 *
 * The claim under test is the one the archetype exists to teach: a suite can
 * execute every line and still let specific, nameable changes through. So the
 * fixture is a weak suite with a KNOWN survivor, and the tests assert the
 * harness finds exactly it.
 */

/** Classify a score into a grade band — the function under test. */
type Grade = (score: number) => string;

const baseline: Grade = (score) => {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  return "C";
};

/**
 * Deliberately weak: it never probes a boundary, so an off-by-one at the
 * threshold is invisible to it.
 */
const weakSuite: MutationSuite<Grade> = {
  baseline,
  mutants: [
    {
      id: "gte-to-gt",
      label: "`>= 90` became `> 90`",
      codeLine: 0,
      // Only differs AT exactly 90 — which the weak suite never tries.
      fn: (score) => (score > 90 ? "A" : score >= 80 ? "B" : "C"),
    },
    {
      id: "swap-return",
      label: "returns B where it should return A",
      codeLine: 0,
      fn: (score) => (score >= 90 ? "B" : score >= 80 ? "B" : "C"),
    },
    {
      id: "always-c",
      label: "always returns C",
      codeLine: 2,
      fn: () => "C",
    },
    {
      id: "throws",
      label: "throws instead of returning",
      codeLine: 1,
      fn: () => {
        throw new Error("boom");
      },
    },
  ],
  tests: [
    { name: "95 is an A", run: (fn) => fn(95) === "A" },
    { name: "85 is a B", run: (fn) => fn(85) === "B" },
    { name: "40 is a C", run: (fn) => fn(40) === "C" },
  ],
};

/** The same suite plus the boundary case that closes the hole. */
const strongSuite: MutationSuite<Grade> = {
  ...weakSuite,
  tests: [
    ...weakSuite.tests,
    { name: "90 is exactly an A", run: (fn) => fn(90) === "A" },
  ],
};

const last = (steps: { state: MutationState }[]) =>
  steps[steps.length - 1].state;

describe("runMutationSuite", () => {
  it("is deterministic for a given seed", () => {
    expect(runMutationSuite(weakSuite, mulberry32(9))).toEqual(
      runMutationSuite(weakSuite, mulberry32(9)),
    );
  });

  it("verifies the baseline before judging any mutant", () => {
    const steps = runMutationSuite(weakSuite, mulberry32(1));
    expect(steps[0].state.baselineGreen).toBeNull();
    // The first executions are baseline runs: no mutant attached.
    expect(steps[1].state.running?.mutantId).toBeNull();
    expect(steps[1].state.lastResult).toBe("pass");
    // Every mutant is still untouched while the baseline is being checked.
    expect(steps[1].state.mutants.every((m) => m.status === "pending")).toBe(true);
    expect(last(steps).baselineGreen).toBe(true);
  });

  it("stops immediately when the suite fails the correct code", () => {
    const brokenSuite: MutationSuite<Grade> = {
      ...weakSuite,
      tests: [{ name: "95 is a B (wrong)", run: (fn) => fn(95) === "B" }],
    };
    const steps = runMutationSuite(brokenSuite, mulberry32(1));

    expect(last(steps).baselineGreen).toBe(false);
    // No mutant was judged, and the score stayed empty.
    expect(last(steps).mutants.every((m) => m.status === "pending")).toBe(true);
    expect(last(steps).killed).toBe(0);
    expect(last(steps).survived).toBe(0);
    expect(last(steps).mutants.every((m) => m.testsRun === 0)).toBe(true);
  });

  it("finds the boundary survivor the weak suite cannot see", () => {
    const state = last(runMutationSuite(weakSuite, mulberry32(3)));
    const survivors = state.mutants.filter((m) => m.status === "survived");

    expect(survivors.map((m) => m.id)).toEqual(["gte-to-gt"]);
    expect(state.killed).toBe(3);
    expect(state.survived).toBe(1);
    // Every mutant got a verdict.
    expect(state.mutants.every((m) => m.status !== "pending")).toBe(true);
  });

  it("kills that survivor once the boundary test exists", () => {
    const state = last(runMutationSuite(strongSuite, mulberry32(3)));
    expect(state.survived).toBe(0);
    expect(state.killed).toBe(4);
    expect(
      state.mutants.find((m) => m.id === "gte-to-gt")?.killedBy,
    ).toBe("90 is exactly an A");
  });

  it("treats a throwing mutant as killed, not as a harness error", () => {
    const state = last(runMutationSuite(weakSuite, mulberry32(3)));
    const thrower = state.mutants.find((m) => m.id === "throws")!;
    expect(thrower.status).toBe("killed");
    expect(thrower.killedBy).toBe("95 is an A");
  });

  it("stops a mutant at its first killer instead of running the rest", () => {
    const state = last(runMutationSuite(weakSuite, mulberry32(3)));
    const alwaysC = state.mutants.find((m) => m.id === "always-c")!;
    // "95 is an A" fails first, so only one test ran.
    expect(alwaysC.killedBy).toBe("95 is an A");
    expect(alwaysC.testsRun).toBe(1);
    // A survivor, by contrast, must have run the whole suite.
    const survivor = state.mutants.find((m) => m.id === "gte-to-gt")!;
    expect(survivor.testsRun).toBe(weakSuite.tests.length);
  });

  it("reshuffles the narrative per seed without changing the verdict", () => {
    const orders = new Set<string>();
    for (let seed = 0; seed < 25; seed++) {
      const steps = runMutationSuite(weakSuite, mulberry32(seed));
      const state = last(steps);
      // The verdict is a property of the SUITE, not of the order.
      expect(state.survived).toBe(1);
      expect(state.killed).toBe(3);
      orders.add(
        steps
          .map((s) => s.state.running?.mutantId ?? "")
          .filter(Boolean)
          .join(">"),
      );
    }
    expect(orders.size).toBeGreaterThan(1);
  });

  it("counts every test execution, baseline included", () => {
    const steps = runMutationSuite(weakSuite, mulberry32(3));
    const state = last(steps);
    const executed = state.mutants.reduce((n, m) => n + m.testsRun, 0);
    expect(steps[steps.length - 1].counters[MUTATION_COUNTERS.tests]).toBe(
      weakSuite.tests.length + executed,
    );
    expect(steps[steps.length - 1].counters[MUTATION_COUNTERS.killed]).toBe(3);
    expect(steps[steps.length - 1].counters[MUTATION_COUNTERS.survived]).toBe(1);
  });

  it("never aliases a frame, so step-back shows the score as it was", () => {
    const steps = runMutationSuite(weakSuite, mulberry32(3));
    expect(new Set(steps.map((s) => s.state)).size).toBe(steps.length);
    expect(new Set(steps.map((s) => s.state.mutants)).size).toBe(steps.length);
    // Monotonic: verdicts accumulate, never retract.
    let killed = 0;
    for (const step of steps) {
      expect(step.state.killed).toBeGreaterThanOrEqual(killed);
      killed = step.state.killed;
    }
  });
});

describe("archetype D rides on archetype B", () => {
  const mutationDef: AlgoDef<MutationState, MutationSuite<Grade>> = {
    id: "mutation-score",
    title: "mutation testing",
    code: ["if score >= 90: return A", "if score >= 80: return B", "return C"],
    counters: [
      { key: MUTATION_COUNTERS.tests, label: "tests run" },
      { key: MUTATION_COUNTERS.killed, label: "mutants killed" },
      { key: MUTATION_COUNTERS.survived, label: "survived" },
    ],
    generateInput: () => weakSuite,
    run: (suite, rng) => runMutationSuite(suite, rng),
  };

  it("runs through buildAlgoSteps, reproducibly per seed", () => {
    const steps = buildAlgoSteps(mutationDef, 0, 42);
    expect(steps).toEqual(buildAlgoSteps(mutationDef, 0, 42));
    expect(last(steps).survived).toBe(1);
  });

  it("keeps codeLine pointing into the def's code", () => {
    for (const step of buildAlgoSteps(mutationDef, 0, 42)) {
      if (step.codeLine === undefined) continue;
      expect(step.codeLine).toBeLessThan(mutationDef.code.length);
    }
  });

  it("satisfies the view contract the figure requires", () => {
    const view: ComponentType<{ state: MutationState }> = MutationView;
    expect(view).toBe(MutationView);
  });
});
