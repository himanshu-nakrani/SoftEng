import { buildAlgoSteps } from "@/engine/algo/build";
import { JIT_COUNTERS as C, JIT_HOT, runJit } from "@/engine/algo/jit";
import type { AlgoDef } from "@/engine/algo/types";
import type { JitState } from "@/engine/algo/views/jit";
import { HOT, jitCompilationAlgo } from "@/lessons/runtime-systems/jit-compilation";
import { describe, expect, it } from "vitest";

/**
 * The jit-compilation prose states numbers. A failure here means the page
 * now lies, and the message should name the sentence that became untrue.
 *
 * Toy: not a real compiler. Hot is 4. deoptAt is always null — this
 * lesson never deopts. Seed is ignored.
 */

function run(
  def: AlgoDef<JitState, number> = jitCompilationAlgo,
  size = 8,
  seed = 42,
) {
  const steps = buildAlgoSteps(def, size, seed);
  const first = steps[0]!;
  const last = steps[steps.length - 1]!;
  return {
    steps,
    first,
    last,
    state: last.state,
    interpreted: last.counters[C.interpreted] ?? 0,
    compiled: last.counters[C.compiled] ?? 0,
    compiles: last.counters[C.compiles] ?? 0,
    deopts: last.counters[C.deopts] ?? 0,
    stamp: last.state.stamp,
  };
}

const SIZES = [1, 2, 3, 4, 5, 6, 7, 8] as const;

describe("jit-compilation: the slider is how many iterations run, 1 through 8", () => {
  it("offers 1 through 8, default 8, labelled iters", () => {
    // "The slider is how many iterations run, from 1 to 8. Default 8 is
    // the measured run."
    expect(jitCompilationAlgo.id).toBe("jit-compilation");
    expect(jitCompilationAlgo.size).toMatchObject({
      min: 1,
      max: 8,
      default: 8,
      label: "iters",
    });
    expect(jitCompilationAlgo.counters.map((c) => c.key)).toEqual([
      C.interpreted,
      C.compiled,
      C.compiles,
    ]);
  });

  it("does not declare deopts: this lesson never deopts", () => {
    // "There is no deopt here — that is the next lesson."
    // "Deopts stay at 0 on every slider position here — this lesson never
    // deopts."
    expect(jitCompilationAlgo.counters.some((c) => c.key === C.deopts)).toBe(
      false,
    );
    for (const n of SIZES) {
      expect(run(jitCompilationAlgo, n).deopts).toBe(0);
    }
  });

  it("maps the slider onto runJit(iters, null)", () => {
    expect(jitCompilationAlgo.generateInput(() => 0, 8)).toBe(8);
    expect(jitCompilationAlgo.generateInput(() => 0, 3)).toBe(3);
    for (const n of SIZES) {
      expect(buildAlgoSteps(jitCompilationAlgo, n, 42)).toEqual(
        runJit(n, null),
      );
    }
  });

  it("ignores the seed: a compiler is not a scheduler", () => {
    for (const size of SIZES) {
      expect(buildAlgoSteps(jitCompilationAlgo, size, 1)).toEqual(
        buildAlgoSteps(jitCompilationAlgo, size, 99),
      );
    }
  });
});

describe("jit-compilation: hot is 4", () => {
  it("compiles after 4 interpreted hits", () => {
    // "Hot is 4."
    expect(JIT_HOT).toBe(4);
    expect(HOT).toBe(4);
  });
});

describe("jit-compilation: three iterations never compile", () => {
  it("3: interp 3, compiles 0", () => {
    // "At 3: interp 3, compiles 0."
    // "Drag to 3. Interp 3, compiles 0. Three iterations never compile."
    const c = run(jitCompilationAlgo, 3);
    expect(c.interpreted).toBe(3);
    expect(c.compiles).toBe(0);
    expect(c.compiled).toBe(0);
    expect(c.deopts).toBe(0);
    expect(c.stamp).toBe("3 interp");
    expect(c.last.note).toBe("interp 3, compiled 0, deopts 0.");
    expect(c.steps.map((s) => s.note)).not.toContain("Compile after 4 hits.");
  });
});

describe("jit-compilation: four hits compile, and nothing has run compiled yet", () => {
  it("4: interp 4, compiles 1, compiled 0", () => {
    // "At 4: interp 4, compiles 1, compiled 0."
    // "Drag to 4. Interp 4, compiles 1, compiled 0."
    const c = run(jitCompilationAlgo, 4);
    expect(c.interpreted).toBe(4);
    expect(c.compiles).toBe(1);
    expect(c.compiled).toBe(0);
    expect(c.deopts).toBe(0);
  });

  it("the compile caption is Compile after 4 hits.", () => {
    // "Note "Compile after 4 hits.""
    const { steps } = run(jitCompilationAlgo, 4);
    const compile = steps.find((s) => s.note === "Compile after 4 hits.");
    expect(compile).toBeDefined();
    expect(compile!.codeLine).toBe(1);
    expect(compile!.counters[C.compiles]).toBe(1);
    expect(compile!.counters[C.compiled] ?? 0).toBe(0);
    expect(compile!.state.stamp).toBe("compile");
  });
});

describe("jit-compilation: eight iterations pay four compiled", () => {
  it("8: interp 4, compiles 1, compiled 4, deopts 0", () => {
    // "At 8: interp 4, compiles 1, compiled 4, deopts 0."
    // "Eight iterations: interp 4, compiles 1, compiled 4."
    const c = run(jitCompilationAlgo, 8);
    expect(c.interpreted).toBe(4);
    expect(c.compiles).toBe(1);
    expect(c.compiled).toBe(4);
    expect(c.deopts).toBe(0);
  });

  it("the stamp reads 4 compiled, and the last note names deopts 0", () => {
    // "The stamp reads 4 compiled."
    // "Last note "interp 4, compiled 4, deopts 0.""
    const c = run(jitCompilationAlgo, 8);
    expect(c.stamp).toBe("4 compiled");
    expect(c.last.note).toBe("interp 4, compiled 4, deopts 0.");
  });

  it("opens as Loop 8. hot=4. with nothing run yet", () => {
    // "Leave iters at 8. The first caption is "Loop 8. hot=4.""
    const { first } = run(jitCompilationAlgo, 8);
    expect(first.note).toBe("Loop 8. hot=4.");
    expect(first.state.stamp).toBe("interp");
    expect(first.state.iters).toEqual([]);
    expect(first.counters[C.interpreted] ?? 0).toBe(0);
    expect(first.counters[C.compiled] ?? 0).toBe(0);
    expect(first.counters[C.compiles] ?? 0).toBe(0);
  });

  it("the remaining iterations run compiled", () => {
    // "At 4 the loop compiles; the remaining iterations run compiled."
    // "The compile is one event. The remaining four iterations are the
    // payoff."
    for (const n of [5, 6, 7, 8] as const) {
      const c = run(jitCompilationAlgo, n);
      expect(c.interpreted).toBe(4);
      expect(c.compiles).toBe(1);
      expect(c.compiled).toBe(n - 4);
      expect(c.deopts).toBe(0);
    }
  });
});
