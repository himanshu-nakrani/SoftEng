import { buildAlgoSteps } from "@/engine/algo/build";
import {
  PRIO_COUNTERS as C,
  prioWait,
  type PrioConfig,
} from "@/engine/algo/priority";
import type { AlgoDef } from "@/engine/algo/types";
import type { PriorityState } from "@/engine/algo/views/priority";
import {
  priorityInversionAlgo,
  priorityInversionInheritAlgo,
} from "@/lessons/cpu-scheduling/priority-inversion";
import { describe, expect, it } from "vitest";

/**
 * The priority-inversion prose states numbers. A failure here means the
 * page now lies, and the message should name the sentence that became untrue.
 */

function last(def: AlgoDef<PriorityState, PrioConfig>) {
  const steps = buildAlgoSteps(def, 0, 42);
  const final = steps[steps.length - 1]!;
  const { state, counters } = final;
  return {
    steps,
    state,
    counters,
    wait: (id: string) => prioWait(state, id),
    finished: (id: string) =>
      state.tasks.find((t) => t.id === id)?.finishedAt ?? null,
    remaining: (id: string, at: PriorityState) =>
      at.tasks.find((t) => t.id === id)?.remaining ?? null,
    effective: (id: string, at: PriorityState) =>
      at.tasks.find((t) => t.id === id)?.effective ?? null,
  };
}

const inverted = () => last(priorityInversionAlgo);
const inherit = () => last(priorityInversionInheritAlgo);

describe("priority-inversion · the Pathfinder shape", () => {
  it("is L burst 5 prio 0 arrive 0, H burst 2 prio 2 arrive 1, M burst 4 prio 1 arrive 2", () => {
    // "L (burst 5, prio 0) arrives at t=0"
    // "H (burst 2, prio 2) arrives at t=1"
    // "M (burst 4, prio 1) arrives at t=2"
    const tasks = priorityInversionAlgo.generateInput(() => 0, 0).tasks;
    expect(tasks).toEqual([
      { id: "L", burst: 5, priority: 0, arrive: 0, role: "holder" },
      { id: "H", burst: 2, priority: 2, arrive: 1, role: "waiter" },
      { id: "M", burst: 4, priority: 1, arrive: 2, role: "other" },
    ]);
    expect(priorityInversionInheritAlgo.generateInput(() => 0, 0).tasks).toEqual(
      tasks,
    );
  });

  it("has no size slider — inheritance is a second figure, not a control", () => {
    expect(priorityInversionAlgo.size).toBeUndefined();
    expect(priorityInversionInheritAlgo.size).toBeUndefined();
    expect(priorityInversionAlgo.generateInput(() => 0, 0).inherit).toBe(false);
    expect(priorityInversionInheritAlgo.generateInput(() => 0, 0).inherit).toBe(
      true,
    );
  });
});

describe("priority-inversion · no inheritance", () => {
  it("H waits 9, L waits 4, M waits 2 after one inversion", () => {
    // "M is done@6 (wait 2), L is done@9 (wait 4), H is done@11 (wait 9)."
    const run = inverted();
    expect(run.wait("H")).toBe(9);
    expect(run.wait("L")).toBe(4);
    expect(run.wait("M")).toBe(2);
    expect(run.finished("H")).toBe(11);
    expect(run.finished("L")).toBe(9);
    expect(run.finished("M")).toBe(6);
    expect(run.counters[C.inversions]).toBe(1);
  });

  it("Medium preempts Low with remaining 3/5, one preemption, no boost", () => {
    // "M arrives (prio 1) and preempts L. L still holds the lock, remaining 3/5.
    // Preemptions reads 1."
    // "Boosts stays at 0: nothing donated."
    const run = inverted();
    const preempt = run.steps.find((s) => s.note === "M preempts L.");
    expect(preempt).toBeDefined();
    expect(run.remaining("L", preempt!.state)).toBe(3);
    expect(preempt!.state.lockHolder).toBe("L");
    expect(run.counters[C.preemptions]).toBe(1);
    expect(run.counters[C.boosts] ?? 0).toBe(0);
  });

  it("does 11 cpu steps", () => {
    // "The cpu-steps meter ends at 11 — the same work either policy will do."
    expect(inverted().counters[C.steps]).toBe(11);
  });
});

describe("priority-inversion · inheritance", () => {
  it("H waits 5, L waits 0, M waits 7 after one inversion and one boost", () => {
    // "L is done@5 (wait 0), H is done@7 (wait 5), M is done@11 (wait 7)."
    // "Inversions goes to 1 and boosts goes to 1."
    const run = inherit();
    expect(run.wait("H")).toBe(5);
    expect(run.wait("L")).toBe(0);
    expect(run.wait("M")).toBe(7);
    expect(run.finished("H")).toBe(7);
    expect(run.finished("L")).toBe(5);
    expect(run.finished("M")).toBe(11);
    expect(run.counters[C.inversions]).toBe(1);
    expect(run.counters[C.boosts]).toBe(1);
  });

  it("boosts Low to effective 2; Medium never preempts", () => {
    // "L's chip reads prio 0→2."
    // "M arrives. L is not preempted. Preemptions stays at 0."
    const run = inherit();
    const blocked = run.steps.find((s) => s.state.lockWaiter === "H");
    expect(blocked).toBeDefined();
    expect(run.effective("L", blocked!.state)).toBe(2);
    expect(run.steps.some((s) => s.note === "M preempts L.")).toBe(false);
    expect(run.counters[C.preemptions] ?? 0).toBe(0);
  });

  it("does the same 11 cpu steps; High's extra wait without inheritance is Medium's burst", () => {
    // "Same 11 cpu steps. H waits 5 instead of 9."
    // "High's extra 4 steps of waiting without inheritance is Medium's whole burst."
    const without = inverted();
    const withInherit = inherit();
    expect(withInherit.counters[C.steps]).toBe(11);
    expect(without.counters[C.steps]).toBe(11);
    expect(without.wait("H") - withInherit.wait("H")).toBe(4);
    expect(
      priorityInversionAlgo.generateInput(() => 0, 0).tasks.find((t) => t.id === "M")
        ?.burst,
    ).toBe(4);
  });
});
