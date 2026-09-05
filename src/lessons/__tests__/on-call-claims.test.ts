import { buildAlgoSteps } from "@/engine/algo/build";
import type { ScenarioState } from "@/engine/algo/views/scenario";
import type { ScenarioInput } from "@/engine/algo/scenario";
import type { AlgoDef } from "@/engine/algo/types";
import { describe, expect, it } from "vitest";

import { theMutexCallAlgo } from "@/lessons/on-call/the-mutex-call";
import { retryOrBackOffAlgo } from "@/lessons/on-call/retry-or-back-off";
import { zeroDowntimeMigrationAlgo } from "@/lessons/on-call/zero-downtime-migration";

/**
 * Track 11's prose states numbers MEASURED from real sub-runs — "correct in 54
 * of 200", "all 200", "roughly half", "about 102". Same contract as the other
 * claim suites: a failure here means an on-call scenario page now lies about a
 * figure its own producer measured.
 *
 * These have been PROVEN to fail: break the lock handling in `interleave`, or
 * the measurement in `algo/scenario.ts`, and the numbers move and this suite
 * goes red.
 */
function chosen<I>(def: AlgoDef<ScenarioState, I>, size: number) {
  const state = buildAlgoSteps(def, size, 42).at(-1)!.state;
  const option = state.options.find((o) => o.chosen)!;
  return { state, option };
}
function optionById(def: AlgoDef<ScenarioState, ScenarioInput>, id: string) {
  return buildAlgoSteps(def, 0, 42).at(-1)!.state.options.find((o) => o.id === id)!;
}

describe("the-mutex-call — a choice mutates a real run's measured outcome", () => {
  it("leaving the race is correct in exactly 54 of 200 runs", () => {
    expect(optionById(theMutexCallAlgo, "ship").outcome.value).toBe(54);
    expect(optionById(theMutexCallAlgo, "ship").outcome.outOf).toBe(200);
  });

  it("the mutex is correct in all 200 runs", () => {
    expect(optionById(theMutexCallAlgo, "lock").outcome.value).toBe(200);
  });

  it("the two choices produce different measured outcomes — the hard gate", () => {
    const ship = optionById(theMutexCallAlgo, "ship").outcome.value;
    const lock = optionById(theMutexCallAlgo, "lock").outcome.value;
    expect(ship).not.toBe(lock);
    // The slider selects the choice, and the chosen option follows it.
    expect(chosen(theMutexCallAlgo, 0).option.id).toBe("ship");
    expect(chosen(theMutexCallAlgo, 1).option.id).toBe("lock");
  });
});

describe("retry-or-back-off — lock ordering is a measured distribution", () => {
  it("enforcing one order completes all 200 runs", () => {
    expect(optionById(retryOrBackOffAlgo, "same").outcome.value).toBe(200);
  });

  it("opposite orders complete about half — 102 of 200, the rest deadlock", () => {
    const opposite = optionById(retryOrBackOffAlgo, "opposite").outcome.value;
    expect(opposite).toBe(102);
    // "roughly half" in the prose — assert it is genuinely a middling fraction,
    // not a degenerate 0 or 200, which is what makes the lesson about a rate.
    expect(opposite).toBeGreaterThan(60);
    expect(opposite).toBeLessThan(160);
  });

  it("the safe order strictly beats the risky one", () => {
    expect(optionById(retryOrBackOffAlgo, "same").outcome.value).toBeGreaterThan(
      optionById(retryOrBackOffAlgo, "opposite").outcome.value,
    );
  });
});

describe("zero-downtime-migration — schema migration under continuous traffic", () => {
  it("a single ALTER TABLE rename causes exclusive locks and drops writes in all 200 runs", () => {
    const alter = optionById(zeroDowntimeMigrationAlgo, "alter-table");
    expect(alter.outcome.value).toBe(0);
    expect(alter.outcome.outOf).toBe(200);
    expect(alter.outcome.headline).toBe("dropped writes ranged 200 to 300 — held in 0/200 runs");
  });

  it("prematurely reading new columns fails reads across all 200 runs", () => {
    const premature = optionById(zeroDowntimeMigrationAlgo, "premature-read");
    expect(premature.outcome.value).toBe(0);
    expect(premature.outcome.outOf).toBe(200);
    expect(premature.outcome.headline).toBe("unmigrated null reads ranged 200 to 300 — held in 0/200 runs");
  });

  it("the expand/contract pattern completes cleanly with zero dropped writes in all 200 runs", () => {
    const expand = optionById(zeroDowntimeMigrationAlgo, "expand-contract");
    expect(expand.outcome.value).toBe(200);
    expect(expand.outcome.outOf).toBe(200);
    expect(expand.outcome.headline).toBe("dropped writes held 0 — held in 200/200 runs");
  });

  it("the slider selects each migration strategy and mutates the chosen outcome", () => {
    expect(chosen(zeroDowntimeMigrationAlgo, 0).option.id).toBe("alter-table");
    expect(chosen(zeroDowntimeMigrationAlgo, 1).option.id).toBe("premature-read");
    expect(chosen(zeroDowntimeMigrationAlgo, 2).option.id).toBe("expand-contract");
  });
});
