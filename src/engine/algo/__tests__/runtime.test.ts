import { buildAlgoSteps } from "@/engine/algo/build";
import {
  EVAL_EXPRS,
  RUNTIME_COUNTERS as C,
  STACK_CAP,
  runBytecode,
  runCallStack,
  runWalk,
} from "@/engine/algo/runtime";
import type { AlgoDef } from "@/engine/algo/types";
import type { RuntimeState } from "@/engine/algo/views/runtime";
import { RuntimeView } from "@/engine/algo/views/RuntimeView";
import type { ComponentType } from "react";
import { describe, expect, it } from "vitest";

describe("runWalk / runBytecode", () => {
  it("1+2*3 is 7 on both machines", () => {
    expect(EVAL_EXPRS[1]).toBe("1+2*3");
    expect(runWalk(1).at(-1)!.state.result).toBe(7);
    expect(runBytecode(1).at(-1)!.state.result).toBe(7);
    expect(runWalk(1).at(-1)!.counters[C.visits]).toBe(5);
    expect(runBytecode(1).at(-1)!.counters[C.ops]).toBe(5);
    expect(runBytecode(1).at(-1)!.counters[C.stack]).toBe(3);
  });

  it("(1+2)*3 is 9 with stack max 2", () => {
    expect(runWalk(2).at(-1)!.state.result).toBe(9);
    expect(runBytecode(2).at(-1)!.state.result).toBe(9);
    expect(runBytecode(2).at(-1)!.counters[C.stack]).toBe(2);
  });

  it("1+2 is 3, visits 3, ops 3, stack 2", () => {
    expect(runWalk(0).at(-1)!.state.result).toBe(3);
    expect(runWalk(0).at(-1)!.counters[C.visits]).toBe(3);
    expect(runBytecode(0).at(-1)!.counters[C.ops]).toBe(3);
    expect(runBytecode(0).at(-1)!.counters[C.stack]).toBe(2);
  });
});

describe("runCallStack", () => {
  it("f(3) is 6 at depth 4; f(4) overflows the cap of 4", () => {
    expect(STACK_CAP).toBe(4);
    expect(runCallStack(0).at(-1)!.state.result).toBe(1);
    expect(runCallStack(0).at(-1)!.counters[C.depth]).toBe(1);
    expect(runCallStack(3).at(-1)!.state.result).toBe(6);
    expect(runCallStack(3).at(-1)!.counters[C.depth]).toBe(4);
    expect(runCallStack(3).at(-1)!.counters[C.overflow] ?? 0).toBe(0);
    expect(runCallStack(4).at(-1)!.counters[C.overflow]).toBe(1);
    expect(runCallStack(4).at(-1)!.state.overflow).toBe(true);
    expect(runCallStack(4).at(-1)!.state.result).toBeNull();
  });
});

describe("runtime rides on archetype B", () => {
  const def: AlgoDef<RuntimeState, number> = {
    id: "walk",
    title: "walk",
    code: ["leaf", "op"],
    counters: [{ key: C.visits, label: "visits" }],
    size: { label: "expr", min: 0, max: 2, default: 1 },
    generateInput: (_rng, size) => size,
    run: (size) => runWalk(size),
  };

  it("size changes the expr and the view contract holds", () => {
    expect(buildAlgoSteps(def, 0, 1)).not.toEqual(buildAlgoSteps(def, 1, 1));
    const view: ComponentType<{ state: RuntimeState }> = RuntimeView;
    expect(view).toBe(RuntimeView);
  });
});
