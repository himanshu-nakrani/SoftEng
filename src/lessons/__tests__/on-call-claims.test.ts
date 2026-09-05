import { buildAlgoSteps } from "@/engine/algo/build";
import type { ScenarioState } from "@/engine/algo/views/scenario";
import type { ScenarioInput } from "@/engine/algo/scenario";
import type { AlgoDef } from "@/engine/algo/types";
import { describe, expect, it } from "vitest";

import { theMutexCallAlgo } from "@/lessons/on-call/the-mutex-call";
import { retryOrBackOffAlgo } from "@/lessons/on-call/retry-or-back-off";
import { threadPoolSizingAlgo } from "@/lessons/on-call/thread-pool-sizing";
import { circuitBreakerHysteresisAlgo } from "@/lessons/on-call/circuit-breaker-hysteresis";
import { zeroDowntimeMigrationAlgo } from "@/lessons/on-call/zero-downtime-migration";
import { splitBrainPartitionAlgo } from "@/lessons/resilience-engineering/split-brain-partition";

/**
 * Track 11's prose states numbers MEASURED from real sub-runs — "correct in 54
 * of 200", "all 200", "roughly half", "about 102", "29 of 200". Same contract
 * as the other claim suites: a failure here means an on-call scenario page now
 * lies about a figure its own producer measured.
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

describe("thread-pool-sizing — concurrency limits vs queue depth under downstream spike", () => {
  it("bounded pool with load shedding holds SLA in all 200 runs at 400ms", () => {
    const bounded = optionById(threadPoolSizingAlgo, "bounded-pool");
    expect(bounded.outcome.value).toBe(200);
    expect(bounded.outcome.outOf).toBe(200);
    expect(bounded.outcome.headline).toBe("p99 latency (ms) held 400 — held in 200/200 runs");
  });

  it("unbounded queue explodes latency to 30s and holds SLA in 0 of 200 runs", () => {
    const queue = optionById(threadPoolSizingAlgo, "unbounded-queue");
    expect(queue.outcome.value).toBe(0);
    expect(queue.outcome.outOf).toBe(200);
    expect(queue.outcome.headline).toBe("p99 latency (ms) held 30000 — held in 0/200 runs");
  });

  it("expanding thread pool thrashes and holds SLA in only 29 of 200 runs", () => {
    const expand = optionById(threadPoolSizingAlgo, "expand-pool");
    expect(expand.outcome.value).toBe(29);
    expect(expand.outcome.outOf).toBe(200);
    expect(expand.outcome.headline).toBe("p99 latency (ms) ranged 1600 to 2400 — held in 29/200 runs");
  });

  it("slider selects the corresponding policy choice", () => {
    expect(chosen(threadPoolSizingAlgo, 0).option.id).toBe("expand-pool");
    expect(chosen(threadPoolSizingAlgo, 1).option.id).toBe("unbounded-queue");
    expect(chosen(threadPoolSizingAlgo, 2).option.id).toBe("bounded-pool");
  });

  it("the bounded pool with shedding strictly dominates unbounded queue and thread expansion", () => {
    const bounded = optionById(threadPoolSizingAlgo, "bounded-pool").outcome.value;
    const expand = optionById(threadPoolSizingAlgo, "expand-pool").outcome.value;
    const queue = optionById(threadPoolSizingAlgo, "unbounded-queue").outcome.value;
    expect(bounded).toBeGreaterThan(expand);
    expect(expand).toBeGreaterThan(queue);
  });
});

describe("circuit-breaker-hysteresis — recovery damping prevents flapping and artificial downtime", () => {
  it("immediate full close fails all 200 runs under thundering herd", () => {
    expect(optionById(circuitBreakerHysteresisAlgo, "immediate").outcome.value).toBe(0);
    expect(optionById(circuitBreakerHysteresisAlgo, "immediate").outcome.outOf).toBe(200);
  });

  it("fixed 60-second cooldown recovers cleanly in exactly 100 of 200 runs", () => {
    const cooldown = optionById(circuitBreakerHysteresisAlgo, "cooldown").outcome.value;
    expect(cooldown).toBe(100);
    expect(optionById(circuitBreakerHysteresisAlgo, "cooldown").outcome.outOf).toBe(200);
    // In prose: "100 of 200" / "about half"
    expect(cooldown).toBeGreaterThan(60);
    expect(cooldown).toBeLessThan(140);
  });

  it("half-open rate-ramping recovers cleanly in all 200 runs", () => {
    expect(optionById(circuitBreakerHysteresisAlgo, "half-open").outcome.value).toBe(200);
    expect(optionById(circuitBreakerHysteresisAlgo, "half-open").outcome.outOf).toBe(200);
  });

  it("the three choices produce strictly ordered measured outcomes", () => {
    const immediate = optionById(circuitBreakerHysteresisAlgo, "immediate").outcome.value;
    const cooldown = optionById(circuitBreakerHysteresisAlgo, "cooldown").outcome.value;
    const halfOpen = optionById(circuitBreakerHysteresisAlgo, "half-open").outcome.value;

    expect(halfOpen).toBeGreaterThan(cooldown);
    expect(cooldown).toBeGreaterThan(immediate);

    // Slider selects the 3 choices in order
    expect(chosen(circuitBreakerHysteresisAlgo, 0).option.id).toBe("immediate");
    expect(chosen(circuitBreakerHysteresisAlgo, 1).option.id).toBe("cooldown");
    expect(chosen(circuitBreakerHysteresisAlgo, 2).option.id).toBe("half-open");
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

describe("split-brain-partition — network partition handling in a 3-node cluster", () => {
  it("allowing both sides to write causes catastrophic data loss in all 200 runs", () => {
    const both = optionById(splitBrainPartitionAlgo, "both-accept");
    expect(both.outcome.value).toBe(0);
    expect(both.outcome.outOf).toBe(200);
    expect(both.outcome.headline).toBe("lost writes ranged 40 to 60 — held in 0/200 runs");
  });

  it("freezing all writes drops availability to 0% and fails SLA across all 200 runs", () => {
    const freeze = optionById(splitBrainPartitionAlgo, "freeze-writes");
    expect(freeze.outcome.value).toBe(0);
    expect(freeze.outcome.outOf).toBe(200);
    expect(freeze.outcome.headline).toBe("write availability (%) held 0 — held in 0/200 runs");
  });

  it("majority quorum with fencing commits safely with 0 lost writes in all 200 runs", () => {
    const quorum = optionById(splitBrainPartitionAlgo, "majority-quorum");
    expect(quorum.outcome.value).toBe(200);
    expect(quorum.outcome.outOf).toBe(200);
    expect(quorum.outcome.headline).toBe("lost writes held 0 — held in 200/200 runs");
  });

  it("slider selects the three partition policies in order", () => {
    expect(chosen(splitBrainPartitionAlgo, 0).option.id).toBe("both-accept");
    expect(chosen(splitBrainPartitionAlgo, 1).option.id).toBe("freeze-writes");
    expect(chosen(splitBrainPartitionAlgo, 2).option.id).toBe("majority-quorum");
  });

  it("majority quorum strictly dominates uncoordinated writes and cluster freeze", () => {
    const quorum = optionById(splitBrainPartitionAlgo, "majority-quorum").outcome.value;
    const both = optionById(splitBrainPartitionAlgo, "both-accept").outcome.value;
    const freeze = optionById(splitBrainPartitionAlgo, "freeze-writes").outcome.value;
    expect(quorum).toBe(200);
    expect(both).toBe(0);
    expect(freeze).toBe(0);
  });
});
