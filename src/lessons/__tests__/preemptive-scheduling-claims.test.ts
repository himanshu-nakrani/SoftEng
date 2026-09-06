import { buildAlgoSteps } from "@/engine/algo/build";
import {
  SCHED_COUNTERS as C,
  waitTime,
  type SchedConfig,
} from "@/engine/algo/scheduler";
import type { AlgoDef } from "@/engine/algo/types";
import type { SchedulerState } from "@/engine/algo/views/scheduler";
import {
  preemptiveSchedulingAlgo,
  preemptiveSchedulingPreemptAlgo,
} from "@/lessons/cpu-scheduling/preemptive-scheduling";
import { describe, expect, it } from "vitest";

/**
 * The preemptive-scheduling prose states numbers. A failure here means the
 * page now lies, and the message should name the sentence that became untrue.
 */

function last(def: AlgoDef<SchedulerState, SchedConfig>, size: number) {
  const steps = buildAlgoSteps(def, size, 42);
  const final = steps[steps.length - 1]!;
  const { state, counters } = final;
  return {
    state,
    counters,
    wait: (id: string) => waitTime(state, id),
    finished: (id: string) =>
      state.tasks.find((t) => t.id === id)?.finishedAt ?? null,
  };
}

const coop = () => last(preemptiveSchedulingAlgo, 1);
const preempt = (quantum: number) =>
  last(preemptiveSchedulingPreemptAlgo, quantum);

describe("preemptive-scheduling · cooperative convoy", () => {
  it("waits A=0, B=8, C=10 with zero preemptions", () => {
    // "B waited 8; C waited 10. A waited 0."
    // "The preemptions meter stays at 0."
    const run = coop();
    expect(run.wait("A")).toBe(0);
    expect(run.wait("B")).toBe(8);
    expect(run.wait("C")).toBe(10);
    expect(run.counters[C.preemptions] ?? 0).toBe(0);
  });

  it("finishes A at t=8, B at t=10, C at t=12", () => {
    // "A does not leave until remaining hits 0, at t=8."
    // "B is done@10, C is done@12."
    const run = coop();
    expect(run.finished("A")).toBe(8);
    expect(run.finished("B")).toBe(10);
    expect(run.finished("C")).toBe(12);
  });

  it("does 12 cpu steps with 3 switches", () => {
    // "The cpu-steps meter ends at 12 — the same work either policy will do.
    // Switches is 3: one dispatch each."
    const run = coop();
    expect(run.counters[C.steps]).toBe(12);
    expect(run.counters[C.switches]).toBe(3);
  });
});

describe("preemptive-scheduling · the timer", () => {
  it("offers quantum 1 through 8, default 1", () => {
    expect(preemptiveSchedulingPreemptAlgo.size).toMatchObject({
      min: 1,
      max: 8,
      default: 1,
    });
    expect(preemptiveSchedulingAlgo.size).toBeUndefined();
  });

  it("at quantum 1, waits A=4, B=3, C=4 after four preemptions", () => {
    // "B is done@5 (wait 3), C is done@6 (wait 4), A is done@12 (wait 4).
    // Preemptions reads 4."
    // "At quantum 1, A waits 4, B waits 3, C waits 4. Four preemptions."
    const run = preempt(1);
    expect(run.wait("A")).toBe(4);
    expect(run.wait("B")).toBe(3);
    expect(run.wait("C")).toBe(4);
    expect(run.finished("A")).toBe(12);
    expect(run.finished("B")).toBe(5);
    expect(run.finished("C")).toBe(6);
    expect(run.counters[C.preemptions]).toBe(4);
  });

  it("does the same 12 steps with 7 switches instead of 3", () => {
    // "The same 12 steps of work, 7 switches instead of 3."
    const run = preempt(1);
    expect(run.counters[C.steps]).toBe(12);
    expect(run.counters[C.switches]).toBe(7);
  });

  it("at quantum 2, B waits 2", () => {
    // "Drag quantum to 2. B now waits 2 — it ran its whole burst on first
    // dispatch."
    expect(preempt(2).wait("B")).toBe(2);
  });

  it("at quantum 8, the waits match cooperative", () => {
    // "Then drag to 8: B waits 8 again, and preemptions is 0."
    // "B waits 8 again, preemptions 0, A waits 0."
    const run = preempt(8);
    expect(run.wait("A")).toBe(0);
    expect(run.wait("B")).toBe(8);
    expect(run.wait("C")).toBe(10);
    expect(run.counters[C.preemptions] ?? 0).toBe(0);
  });
});
