import { buildAlgoSteps } from "@/engine/algo/build";
import { JIT_COUNTERS as C, JIT_HOT, runJit } from "@/engine/algo/jit";
import type { AlgoDef } from "@/engine/algo/types";
import type { JitState } from "@/engine/algo/views/jit";
import { deoptimizationAlgo } from "@/lessons/runtime-systems/deoptimization";
import { describe, expect, it } from "vitest";

/**
 * The deoptimization prose states numbers. A failure here means the page
 * now lies, and the message should name the sentence that became untrue.
 *
 * Always 8 iterations. The slider is which iteration deopts, 5 through 8.
 * Seed is ignored: a type fail is not a scheduler.
 */

function run(def: AlgoDef<JitState, number> = deoptimizationAlgo, at = 6, seed = 42) {
  const steps = buildAlgoSteps(def, at, seed);
  const first = steps[0]!;
  const last = steps[steps.length - 1]!;
  return {
    steps,
    first,
    last,
    state: last.state,
    stamp: last.state.stamp,
    interpreted: last.counters[C.interpreted] ?? 0,
    compiled: last.counters[C.compiled] ?? 0,
    compiles: last.counters[C.compiles] ?? 0,
    deopts: last.counters[C.deopts] ?? 0,
    tiers: last.state.iters.map((it) => it.tier),
  };
}

const POINTS = [5, 6, 7, 8] as const;

describe("deoptimization: the slider is which iteration deopts, 5 through 8", () => {
  it("offers 5 through 8, default 6, labelled deopt at", () => {
    // "Always 8 iterations. The slider is which iteration fails the type
    // assumption, from 5 to 8. Default 6 is the measured run."
    expect(deoptimizationAlgo.id).toBe("deoptimization");
    expect(deoptimizationAlgo.size).toMatchObject({
      min: 5,
      max: 8,
      default: 6,
      label: "deopt at",
    });
    expect(deoptimizationAlgo.counters.map((c) => c.key)).toEqual([
      C.interpreted,
      C.compiled,
      C.compiles,
      C.deopts,
    ]);
  });

  it("always runs 8 iterations, whatever the deopt point", () => {
    // "Always 8 iterations."
    for (const at of POINTS) {
      expect(deoptimizationAlgo.generateInput(() => 0, at)).toBe(at);
      expect(run(deoptimizationAlgo, at).state.iters).toHaveLength(8);
      expect(run(deoptimizationAlgo, at).state.iters.map((it) => it.n)).toEqual([
        1, 2, 3, 4, 5, 6, 7, 8,
      ]);
    }
  });

  it("the lesson def is the same run as runJit(8, at)", () => {
    for (const at of POINTS) {
      expect(buildAlgoSteps(deoptimizationAlgo, at, 42)).toEqual(runJit(8, at));
    }
  });

  it("ignores the seed: a type fail is not a scheduler", () => {
    for (const at of POINTS) {
      expect(buildAlgoSteps(deoptimizationAlgo, at, 1)).toEqual(
        buildAlgoSteps(deoptimizationAlgo, at, 99),
      );
    }
  });
});

describe("deoptimization: hot is 4, so 5 is the first compiled iter", () => {
  it("compiles after 4 interpreted hits", () => {
    // "After 4 interpreted hits the loop compiled for ints."
    // "Hot is 4, so 5 is the first compiled iter."
    expect(JIT_HOT).toBe(4);
    const { steps } = run(deoptimizationAlgo, 6);
    const compile = steps.find((s) => s.note === "Compile after 4 hits.")!;
    expect(compile.counters[C.interpreted]).toBe(4);
    expect(compile.counters[C.compiles]).toBe(1);
    expect(compile.counters[C.compiled] ?? 0).toBe(0);
    expect(compile.state.stamp).toBe("compile");
  });
});

describe("deoptimization: deopt at 6 (default)", () => {
  it("opens with Loop 8. deopt at 6.", () => {
    // "Leave deopt at 6. The first caption is "Loop 8. deopt at 6.""
    const { first } = run(deoptimizationAlgo, 6);
    expect(first.note).toBe("Loop 8. deopt at 6.");
    expect(first.state.stamp).toBe("interp");
    expect(first.state.iters).toEqual([]);
    expect(first.counters[C.interpreted] ?? 0).toBe(0);
    expect(first.counters[C.compiled] ?? 0).toBe(0);
    expect(first.counters[C.compiles] ?? 0).toBe(0);
    expect(first.counters[C.deopts] ?? 0).toBe(0);
  });

  it("iter 5 runs compiled, then Deopt at iter 6, then iters 7 and 8 are interp", () => {
    // "Iter 5 runs compiled. Then: "Deopt at iter 6." Iters 7 and 8 are
    // interp again."
    const { steps, tiers } = run(deoptimizationAlgo, 6);
    expect(steps.some((s) => s.note === "Compiled iter 5.")).toBe(true);
    const deopt = steps.find((s) => s.note === "Deopt at iter 6.")!;
    expect(deopt.state.stamp).toBe("deopt");
    expect(deopt.state.iters.find((it) => it.n === 6)?.tier).toBe("deopt");
    expect(steps.some((s) => s.note === "Interp iter 7.")).toBe(true);
    expect(steps.some((s) => s.note === "Interp iter 8.")).toBe(true);
    expect(tiers).toEqual([
      "interp",
      "interp",
      "interp",
      "interp",
      "compiled",
      "deopt",
      "interp",
      "interp",
    ]);
  });

  it("ends at interp 7, compiled 1, deopts 1, stamp deopt", () => {
    // "Last note is "interp 7, compiled 1, deopts 1." The stamp reads
    // deopt. Meters: interpreted 7, compiled 1, compiles 1, deopts 1."
    const c = run(deoptimizationAlgo, 6);
    expect(c.interpreted).toBe(7);
    expect(c.compiled).toBe(1);
    expect(c.compiles).toBe(1);
    expect(c.deopts).toBe(1);
    expect(c.last.note).toBe("interp 7, compiled 1, deopts 1.");
    expect(c.stamp).toBe("deopt");
  });

  it("interp 7 is four warmup hits, the failing iter, and two remaining", () => {
    // "default 6 ends at interp 7, not 6: four warmup hits, the failing
    // iter, and two remaining. Compiled is only iter 5."
    const { state, interpreted, compiled } = run(deoptimizationAlgo, 6);
    expect(interpreted).toBe(7);
    expect(compiled).toBe(1);
    expect(state.iters.filter((it) => it.tier === "interp")).toHaveLength(6);
    expect(state.iters.filter((it) => it.tier === "deopt")).toHaveLength(1);
    expect(state.iters.find((it) => it.n === 5)?.tier).toBe("compiled");
    expect(state.iters.find((it) => it.n === 6)?.tier).toBe("deopt");
  });
});

describe("deoptimization: deopt at 5 is the first compiled iter", () => {
  it("interp 8, compiled 0, deopts 1, compiles 1", () => {
    // "Drag to 5 — the first compiled iter. Interp 8, compiled 0."
    // "At 5 there is no compiled iteration at all: interp 8, compiled 0."
    const c = run(deoptimizationAlgo, 5);
    expect(c.interpreted).toBe(8);
    expect(c.compiled).toBe(0);
    expect(c.compiles).toBe(1);
    expect(c.deopts).toBe(1);
    expect(c.last.note).toBe("interp 8, compiled 0, deopts 1.");
    expect(c.stamp).toBe("deopt");
    expect(c.tiers).toEqual([
      "interp",
      "interp",
      "interp",
      "interp",
      "deopt",
      "interp",
      "interp",
      "interp",
    ]);
    expect(c.state.iters.some((it) => it.tier === "compiled")).toBe(false);
    expect(c.steps.some((s) => s.note === "Deopt at iter 5.")).toBe(true);
  });
});

describe("deoptimization: deopt at 8", () => {
  it("interp 5, compiled 3, deopts 1, compiles 1", () => {
    // "Then drag to 8: interp 5, compiled 3."
    // "At 8 the fail is last, so three compiled iters survive: interp 5,
    // compiled 3."
    const c = run(deoptimizationAlgo, 8);
    expect(c.interpreted).toBe(5);
    expect(c.compiled).toBe(3);
    expect(c.compiles).toBe(1);
    expect(c.deopts).toBe(1);
    expect(c.last.note).toBe("interp 5, compiled 3, deopts 1.");
    expect(c.stamp).toBe("deopt");
    expect(c.tiers).toEqual([
      "interp",
      "interp",
      "interp",
      "interp",
      "compiled",
      "compiled",
      "compiled",
      "deopt",
    ]);
    expect(c.state.iters.find((it) => it.n === 8)?.tier).toBe("deopt");
    expect(c.steps.some((s) => s.note === "Deopt at iter 8.")).toBe(true);
  });
});

describe("deoptimization: every position compiles 1 and deopts 1", () => {
  it("compiles 1 and deopts 1 at 5, 6, 7, and 8, and the stamp is deopt", () => {
    // "Every slider position compiles 1 and deopts 1."
    // "Compiles and deopts stay at 1 either way."
    // "Compiles is 1 on every position — the compile was not free, and
    // it did not come back."
    for (const at of POINTS) {
      const c = run(deoptimizationAlgo, at);
      expect(c.compiles, `deopt at ${at} compiles`).toBe(1);
      expect(c.deopts, `deopt at ${at} deopts`).toBe(1);
      expect(c.stamp).toBe("deopt");
      expect(c.state.iters).toHaveLength(8);
    }
  });
});
