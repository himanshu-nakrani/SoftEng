import { buildAlgoSteps } from "@/engine/algo/build";
import { JIT_COUNTERS as C, JIT_HOT, runJit } from "@/engine/algo/jit";
import type { AlgoDef } from "@/engine/algo/types";
import type { JitState } from "@/engine/algo/views/jit";
import { JitView } from "@/engine/algo/views/JitView";
import type { ComponentType } from "react";
import { describe, expect, it } from "vitest";

const last = (iters: number, deoptAt: number | null = null) =>
  runJit(iters, deoptAt).at(-1)!;

describe("runJit", () => {
  it("compiles after 4 hits; 8 iterations are 4 interp + 4 compiled", () => {
    expect(JIT_HOT).toBe(4);
    expect(last(3).counters[C.interpreted]).toBe(3);
    expect(last(3).counters[C.compiles] ?? 0).toBe(0);
    expect(last(4).counters[C.interpreted]).toBe(4);
    expect(last(4).counters[C.compiles]).toBe(1);
    expect(last(4).counters[C.compiled] ?? 0).toBe(0);
    expect(last(8).counters[C.interpreted]).toBe(4);
    expect(last(8).counters[C.compiled]).toBe(4);
    expect(last(8).counters[C.deopts] ?? 0).toBe(0);
  });

  it("deopt at 6: interp 7, compiled 1, deopts 1", () => {
    const d = last(8, 6);
    expect(d.counters[C.interpreted]).toBe(7);
    expect(d.counters[C.compiled]).toBe(1);
    expect(d.counters[C.deopts]).toBe(1);
    expect(d.counters[C.compiles]).toBe(1);
  });
});

describe("jit rides on archetype B", () => {
  const def: AlgoDef<JitState, number> = {
    id: "jit",
    title: "hot",
    code: ["interp", "compile", "run compiled", "deopt"],
    counters: [{ key: C.interpreted, label: "interpreted" }],
    size: { label: "iters", min: 1, max: 8, default: 8 },
    generateInput: (_rng, size) => size,
    run: (size) => runJit(size, null),
  };

  it("size changes the run and the view contract holds", () => {
    expect(buildAlgoSteps(def, 3, 1)).not.toEqual(buildAlgoSteps(def, 8, 1));
    const view: ComponentType<{ state: JitState }> = JitView;
    expect(view).toBe(JitView);
  });
});
