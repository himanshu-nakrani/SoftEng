import { buildAlgoSteps } from "@/engine/algo/build";
import {
  PRIO_COUNTERS,
  prioWait,
  runPriority,
  type PrioConfig,
} from "@/engine/algo/priority";
import type { AlgoDef } from "@/engine/algo/types";
import type { PriorityState } from "@/engine/algo/views/priority";
import { PriorityView } from "@/engine/algo/views/PriorityView";
import type { ComponentType } from "react";
import { describe, expect, it } from "vitest";

const PATHFINDER: PrioConfig["tasks"] = [
  { id: "L", burst: 5, priority: 0, arrive: 0, role: "holder" },
  { id: "H", burst: 2, priority: 2, arrive: 1, role: "waiter" },
  { id: "M", burst: 4, priority: 1, arrive: 2, role: "other" },
];

const last = (inherit: boolean) => {
  const steps = runPriority({ inherit, tasks: PATHFINDER });
  return { state: steps[steps.length - 1]!.state, counters: steps[steps.length - 1]!.counters, steps };
};

describe("runPriority", () => {
  it("is deterministic and never aliases", () => {
    const a = runPriority({ inherit: false, tasks: PATHFINDER });
    expect(a).toEqual(runPriority({ inherit: false, tasks: PATHFINDER }));
    expect(new Set(a.map((s) => s.state)).size).toBe(a.length);
  });

  it("without inheritance High waits 9 — Low and Medium both ran first", () => {
    const { state } = last(false);
    expect(prioWait(state, "H")).toBe(9);
    expect(prioWait(state, "M")).toBe(2);
  });

  it("with inheritance High waits 5 — Medium is the one that waits", () => {
    const { state } = last(true);
    expect(prioWait(state, "H")).toBe(5);
    expect(prioWait(state, "L")).toBe(0);
    expect(prioWait(state, "M")).toBe(7);
  });
});

describe("priority rides on archetype B", () => {
  const def: AlgoDef<PriorityState, PrioConfig> = {
    id: "prio",
    title: "inherit",
    code: ["arrive", "block on lock", "preempt", "run", "complete"],
    counters: [
      { key: PRIO_COUNTERS.steps, label: "cpu steps" },
      { key: PRIO_COUNTERS.inversions, label: "blocks" },
    ],
    generateInput: () => ({ inherit: true, tasks: PATHFINDER }),
    run: (input) => runPriority(input),
  };

  it("runs through buildAlgoSteps", () => {
    expect(buildAlgoSteps(def, 0, 1)).toEqual(buildAlgoSteps(def, 0, 9));
  });

  it("satisfies the view contract", () => {
    const view: ComponentType<{ state: PriorityState }> = PriorityView;
    expect(view).toBe(PriorityView);
  });
});
