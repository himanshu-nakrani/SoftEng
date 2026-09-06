import { JIT_COUNTERS, JIT_HOT, runJit } from "@/engine/algo/jit";
import type { AlgoDef } from "@/engine/algo/types";
import type { JitState } from "@/engine/algo/views/jit";

/**
 * JIT Compilation — archetype B (`engine: "steps"`).
 *
 * A loop starts interpreted. After JIT_HOT (4) interpreted hits it compiles;
 * later iterations run compiled. THE CONTROL IS HOW MANY ITERATIONS RUN.
 * 1–8, default 8:
 *
 *   3: interp 3, compiles 0
 *   4: interp 4, compiles 1, compiled 0. Note "Compile after 4 hits."
 *   8: interp 4, compiles 1, compiled 4, deopts 0. stamp "4 compiled"
 *
 * `deoptAt` is always null here — this lesson never deopts. The next lesson
 * is the assumption that failed. Seed is ignored: a compiler is not a
 * scheduler.
 *
 * MODELLING NOTE, and its limits. Toy: not a real compiler. Deliberately
 * absent: inline caches, a real IR, OSR. Those change how compilation pays
 * for itself. They do not change the argument: a loop is interpreted until
 * it is hot, then compiled, counted per iteration.
 */

const CODE = ["interpret", "compile", "run compiled"];

export const jitCompilationAlgo: AlgoDef<JitState, number> = {
  id: "jit-compilation",
  title: "hot loop",
  code: CODE,
  counters: [
    { key: JIT_COUNTERS.interpreted, label: "interpreted" },
    { key: JIT_COUNTERS.compiled, label: "compiled" },
    { key: JIT_COUNTERS.compiles, label: "compiles" },
  ],
  size: { label: "iters", min: 1, max: 8, default: 8 },
  generateInput: (_rng, size) => size,
  run: (iters) => runJit(iters, null),
};

/** Pinned: the lesson's hot threshold. Compile fires after this many hits. */
export const HOT = JIT_HOT;
