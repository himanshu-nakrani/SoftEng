import { buildAlgoSteps } from "@/engine/algo/build";
import {
  SCHED_COUNTERS,
  runScheduler,
  waitTime,
  type SchedConfig,
} from "@/engine/algo/scheduler";
import type { AlgoDef } from "@/engine/algo/types";
import type { SchedulerState } from "@/engine/algo/views/scheduler";
import { SchedulerView } from "@/engine/algo/views/SchedulerView";
import type { ComponentType } from "react";
import { describe, expect, it } from "vitest";

const C = SCHED_COUNTERS;

const CONVOY: SchedConfig["tasks"] = [
  { id: "A", burst: 8 },
  { id: "B", burst: 2 },
  { id: "C", burst: 2 },
];

function last(cfg: SchedConfig) {
  const steps = runScheduler(cfg);
  return { steps, state: steps[steps.length - 1]!.state, counters: steps[steps.length - 1]!.counters };
}

describe("runScheduler", () => {
  it("is deterministic, starts idle, never aliases", () => {
    const a = runScheduler({ policy: "cooperative", quantum: 1, tasks: CONVOY });
    expect(a).toEqual(runScheduler({ policy: "cooperative", quantum: 1, tasks: CONVOY }));
    expect(a[0]!.state.cpu).toBeNull();
    expect(a[0]!.counters[C.steps] ?? 0).toBe(0);
    expect(new Set(a.map((s) => s.state)).size).toBe(a.length);
    expect(new Set(a.map((s) => s.state.tasks)).size).toBe(a.length);
  });

  it("cooperative FIFO: the long task at the head makes B wait its full burst", () => {
    const { state, counters } = last({
      policy: "cooperative",
      quantum: 1,
      tasks: CONVOY,
    });
    expect(counters[C.preemptions] ?? 0).toBe(0);
    expect(waitTime(state, "A")).toBe(0);
    expect(waitTime(state, "B")).toBe(8);
    expect(waitTime(state, "C")).toBe(10);
  });

  it("preemptive quantum 1: B gets in before A finishes, so B waits less than 8", () => {
    const { state, counters } = last({
      policy: "preemptive",
      quantum: 1,
      tasks: CONVOY,
    });
    expect(counters[C.preemptions]).toBe(4);
    expect(waitTime(state, "B")).toBe(3);
  });
});

describe("scheduling rides on archetype B", () => {
  const def: AlgoDef<SchedulerState, SchedConfig> = {
    id: "sched",
    title: "preempt",
    code: ["dispatch head", "run one step", "complete or preempt"],
    counters: [
      { key: C.steps, label: "cpu steps" },
      { key: C.switches, label: "switches" },
      { key: C.preemptions, label: "preemptions" },
    ],
    size: { label: "quantum", min: 1, max: 8, default: 1 },
    generateInput: (_rng, size) => ({
      policy: "preemptive",
      quantum: size,
      tasks: CONVOY,
    }),
    run: (input) => runScheduler(input),
  };

  it("runs through buildAlgoSteps; quantum changes the run", () => {
    expect(buildAlgoSteps(def, 1, 1)).toEqual(buildAlgoSteps(def, 1, 99));
    expect(buildAlgoSteps(def, 1, 1)).not.toEqual(buildAlgoSteps(def, 8, 1));
  });

  it("satisfies the view contract", () => {
    const view: ComponentType<{ state: SchedulerState }> = SchedulerView;
    expect(view).toBe(SchedulerView);
  });
});

describe("switchCost charges waste on later dispatches only", () => {
  it("leaves the original convoy waits alone when switchCost is 0", () => {
    const { state } = last({ policy: "preemptive", quantum: 1, tasks: CONVOY });
    expect(waitTime(state, "B")).toBe(3);
  });

  it("adds waste on every dispatch after the first", () => {
    const { counters } = last({
      policy: "preemptive",
      quantum: 1,
      switchCost: 1,
      tasks: CONVOY,
    });
    expect(counters[C.waste]).toBeGreaterThan(0);
    expect(counters[C.steps]).toBe(12);
  });
});

describe("mlfq demotes a long job and lets a short job finish first", () => {
  it("a burst-1 job finishes before a burst-8 job", () => {
    const { state } = last({
      policy: "mlfq",
      quantum: 1,
      tasks: [
        { id: "LONG", burst: 8 },
        { id: "SHORT", burst: 1 },
      ],
    });
    expect(state.tasks.find((t) => t.id === "SHORT")!.finishedAt!).toBeLessThan(
      state.tasks.find((t) => t.id === "LONG")!.finishedAt!,
    );
    const long = state.tasks.find((t) => t.id === "LONG")!;
    expect(long.level).toBe(2);
  });
});
