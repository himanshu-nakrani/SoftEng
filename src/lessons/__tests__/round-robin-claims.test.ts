import { buildAlgoSteps } from "@/engine/algo/build";
import {
  SCHED_COUNTERS as C,
  runScheduler,
  waitTime,
  type SchedConfig,
} from "@/engine/algo/scheduler";
import type { AlgoDef } from "@/engine/algo/types";
import type { SchedulerState } from "@/engine/algo/views/scheduler";
import { roundRobinAlgo } from "@/lessons/cpu-scheduling/round-robin";
import { describe, expect, it } from "vitest";

/**
 * The round-robin prose states numbers. A failure here means the page now
 * lies, and the message should name the sentence that became untrue.
 */

function last(def: AlgoDef<SchedulerState, SchedConfig>, size: number) {
  const steps = buildAlgoSteps(def, size, 42);
  const final = steps[steps.length - 1]!;
  const { state, counters } = final;
  return {
    steps,
    state,
    counters,
    wait: (id: string) => waitTime(state, id),
    finished: (id: string) =>
      state.tasks.find((t) => t.id === id)?.finishedAt ?? null,
  };
}

const run = (quantum: number) => last(roundRobinAlgo, quantum);

const CONVOY: SchedConfig["tasks"] = [
  { id: "A", burst: 8 },
  { id: "B", burst: 2 },
  { id: "C", burst: 2 },
];

describe("round-robin · the control", () => {
  it("offers quantum 1 through 8, default 1, and charges switchCost 1", () => {
    expect(roundRobinAlgo.size).toMatchObject({
      min: 1,
      max: 8,
      default: 1,
    });
    const input = roundRobinAlgo.generateInput(() => 0, 1);
    expect(input.switchCost).toBe(1);
    expect(input.policy).toBe("preemptive");
    expect(input.tasks.map((t) => `${t.id}:${t.burst}`)).toEqual([
      "A:8",
      "B:2",
      "C:2",
    ]);
  });
});

describe("round-robin · quantum 1", () => {
  it("wastes 6, B waits 7, time 18, switches 7, steps 12", () => {
    // "Waste 6, switches 7, cpu steps 12, wall time 18."
    // "B is done@9 (wait 7)"
    const r = run(1);
    expect(r.counters[C.waste]).toBe(6);
    expect(r.wait("B")).toBe(7);
    expect(r.state.time).toBe(18);
    expect(r.counters[C.switches]).toBe(7);
    expect(r.counters[C.steps]).toBe(12);
    expect(r.finished("B")).toBe(9);
  });

  it("finishes C at t=11 wait 9, A at t=18 wait 10, after four preemptions", () => {
    // "C is done@11 (wait 9), A is done@18 (wait 10). Preemptions read 4."
    const r = run(1);
    expect(r.finished("C")).toBe(11);
    expect(r.wait("C")).toBe(9);
    expect(r.finished("A")).toBe(18);
    expect(r.wait("A")).toBe(10);
    expect(r.counters[C.preemptions]).toBe(4);
  });

  it("preempts A at remaining 7, then charges dispatch B at t=2", () => {
    // "A is requeued with remaining 7. The next caption is
    // 'Dispatch B — switch costs 1.' Waste ticks to 1, t=2."
    const { steps } = run(1);
    const preempt = steps.find((s) => s.note === "Timer: preempt A, requeue.");
    expect(preempt).toBeDefined();
    expect(preempt!.state.tasks.find((t) => t.id === "A")!.remaining).toBe(7);
    const paid = steps.find((s) => s.note === "Dispatch B — switch costs 1.");
    expect(paid).toBeDefined();
    expect(paid!.state.time).toBe(2);
    expect(paid!.counters[C.waste]).toBe(1);
  });

  it("has already wasted 4 by the time B finishes at t=9", () => {
    // "Four of the six waste ticks land before B finishes at t=9."
    const { steps } = run(1);
    const done = steps.find((s) => s.note === "B completes at t=9.");
    expect(done).toBeDefined();
    expect(done!.state.time).toBe(9);
    expect(done!.counters[C.waste]).toBe(4);
  });
});

describe("round-robin · quantum 2", () => {
  it("wastes 3, B waits 3, time 15, switches 4", () => {
    // "B is done@5 (wait 3), waste 3, switches 4, time 15."
    const r = run(2);
    expect(r.counters[C.waste]).toBe(3);
    expect(r.wait("B")).toBe(3);
    expect(r.state.time).toBe(15);
    expect(r.counters[C.switches]).toBe(4);
    expect(r.finished("B")).toBe(5);
  });

  it("preempts once so B finishes on first dispatch", () => {
    // "Quantum 2 is kind to B on this convoy because B's burst is 2: it
    // finishes on first dispatch, and A is still cut after two steps.
    // One preemption."
    const r = run(2);
    expect(r.counters[C.preemptions]).toBe(1);
    expect(r.counters[C.steps]).toBe(12);
  });
});

describe("round-robin · quantum 8", () => {
  it("wastes 2, B waits 9, time 14, switches 3", () => {
    // "B waits 9, waste 2, switches 3, time 14, preemptions 0."
    const r = run(8);
    expect(r.counters[C.waste]).toBe(2);
    expect(r.wait("B")).toBe(9);
    expect(r.state.time).toBe(14);
    expect(r.counters[C.switches]).toBe(3);
    expect(r.counters[C.preemptions] ?? 0).toBe(0);
  });

  it("is the convoy plus two dispatch charges: A wait 0 done@8, C wait 12", () => {
    // "A runs to completion (wait 0, done@8)"
    // "B waits 9, C waits 12. That is the convoy plus two dispatch charges."
    const r = run(8);
    expect(r.wait("A")).toBe(0);
    expect(r.finished("A")).toBe(8);
    expect(r.wait("C")).toBe(12);
    expect(r.finished("C")).toBe(14);
    expect(r.finished("B")).toBe(11);
  });
});

describe("round-robin · the work does not change", () => {
  it("does 12 cpu steps at every quantum", () => {
    // "Cpu steps stay 12 at every quantum — the same work."
    for (let q = 1; q <= 8; q++) {
      expect(run(q).counters[C.steps]).toBe(12);
    }
  });
});

describe("round-robin · without switchCost, the previous lesson", () => {
  it("quantum 1 B wait is 3; quantum 8 B wait is 8", () => {
    // "Without the switch cost B waited 3"
    // "Last lesson the same quantum was B wait 8."
    // "Last lesson a 1-step quantum cut B's wait from 8 to 3."
    const q1 = runScheduler({
      policy: "preemptive",
      quantum: 1,
      tasks: CONVOY,
    });
    const q8 = runScheduler({
      policy: "preemptive",
      quantum: 8,
      tasks: CONVOY,
    });
    const coop = runScheduler({
      policy: "cooperative",
      quantum: 1,
      tasks: CONVOY,
    });
    expect(waitTime(q1[q1.length - 1]!.state, "B")).toBe(3);
    expect(waitTime(q8[q8.length - 1]!.state, "B")).toBe(8);
    expect(waitTime(coop[coop.length - 1]!.state, "B")).toBe(8);
  });
});
