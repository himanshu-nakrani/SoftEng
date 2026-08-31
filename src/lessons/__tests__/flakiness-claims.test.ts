import { buildAlgoSteps } from "@/engine/algo/build";
import { CONCURRENCY_COUNTERS as C } from "@/engine/algo/concurrency";
import type { AlgoDef } from "@/engine/algo/types";
import type { ConcurrencyState } from "@/engine/algo/views/threads";
import { describe, expect, it } from "vitest";

import {
  flakyTestsAlgo,
  flakyTestsIsolatedAlgo,
} from "@/lessons/flakiness/flaky-tests";

/**
 * Track 04's flakiness lesson states NUMBERS — "about half of the orders fail",
 * "every order passes", "four steps become six". Each was measured before it
 * was written, but a measurement is only true until the scheduler changes, and
 * nothing else in the suite would notice the prose becoming wrong.
 *
 * So this file pins the CLAIMS, not the implementation. A failure here means
 * the flaky-tests page now lies, and the message names the sentence to fix. It
 * is the archetype-B counterpart of `goldens.test.ts`.
 */

/** Final state at a given seed (size is unused by these defs). */
function run<I>(def: AlgoDef<ConcurrencyState, I>, seed: number) {
  const steps = buildAlgoSteps(def, 0, seed);
  const last = steps[steps.length - 1];
  return {
    steps,
    state: last.state,
    counter: (key: string) => last.counters[key] ?? 0,
  };
}

/** How many of `seeds` runs left at least one test failing. */
function failingRuns<I>(def: AlgoDef<ConcurrencyState, I>, seeds: number): number {
  let fail = 0;
  for (let seed = 0; seed < seeds; seed++) {
    if (run(def, seed).state.memory.failed > 0) fail += 1;
  }
  return fail;
}

describe("flaky-tests: the shared slot is order-dependent, isolation removes it", () => {
  it("ids start with the lesson slug", () => {
    // check-curriculum enforces this, but pin it here so the intent is local.
    expect(flakyTestsAlgo.id).toBe("flaky-tests");
    expect(flakyTestsIsolatedAlgo.id.startsWith("flaky-tests")).toBe(true);
  });

  it("is deterministic: the same seed replays an identical run", () => {
    // The page says "(program, seed) replays one order exactly".
    expect(buildAlgoSteps(flakyTestsAlgo, 0, 42)).toEqual(
      buildAlgoSteps(flakyTestsAlgo, 0, 42),
    );
  });

  it("shows the flake at seed 42: one test fails, one passes", () => {
    // The page's failing-order figure opens at seed 42; the caption says one
    // test reads a value it never wrote and fails while the other passes.
    const { state } = run(flakyTestsAlgo, 42);
    expect(state.memory.passed).toBe(1);
    expect(state.memory.failed).toBe(1);
  });

  it("passes both tests at seed 0 — the SAME code, a different order", () => {
    // The page says the very same suite is green in other orders.
    const { state } = run(flakyTestsAlgo, 0);
    expect(state.memory.passed).toBe(2);
    expect(state.memory.failed).toBe(0);
  });

  it("fails in about half of the shared orders, never all and never none", () => {
    // The page says "about half of the orders leave one test failing".
    expect(failingRuns(flakyTestsAlgo, 200)).toBe(99);
    // Stable across a wider sweep — 500 of 1000 is exactly half.
    expect(failingRuns(flakyTestsAlgo, 1000)).toBe(500);
  });

  it("passes EVERY isolated order — 0 failures across 500 seeds", () => {
    // The page says isolation makes "every order pass".
    expect(failingRuns(flakyTestsIsolatedAlgo, 500)).toBe(0);
  });

  it("costs two extra ops: four steps shared become six isolated, every seed", () => {
    // The page says isolation trades 4 steps for 6 — 50% more work per run.
    for (let seed = 0; seed < 500; seed++) {
      expect(run(flakyTestsAlgo, seed).counter(C.steps)).toBe(4);
      expect(run(flakyTestsIsolatedAlgo, seed).counter(C.steps)).toBe(6);
    }
  });

  it("explores more than one legal order — reseeding is not a no-op", () => {
    // The page says reseeding "explores other legal orders".
    const orders = new Set<string>();
    for (let seed = 0; seed < 40; seed++) {
      orders.add(
        run(flakyTestsAlgo, seed)
          .steps.slice(1)
          .map((f) => f.state.ranOp)
          .join("|"),
      );
    }
    expect(orders.size).toBeGreaterThan(1);
  });
});
