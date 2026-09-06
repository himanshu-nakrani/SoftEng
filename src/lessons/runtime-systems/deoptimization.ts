import { JIT_COUNTERS, runJit } from "@/engine/algo/jit";
import type { AlgoDef } from "@/engine/algo/types";
import type { JitState } from "@/engine/algo/views/jit";

/**
 * Deoptimization — archetype B (`engine: "steps"`).
 *
 * Last lesson the loop compiled after 4 interpreted hits. The compiled
 * body assumed the values stayed ints. This lesson is the moment that
 * assumption fails: one iteration deopts, remaining iterations run
 * interpreted, and the compile still counted.
 *
 * ALWAYS 8 ITERATIONS. THE CONTROL IS WHICH ITERATION DEOPTS. 5–8,
 * default 6. 5 is the first compiled iter (hot is 4). Measured:
 *
 *   deopt at 5: interp 8, compiled 0, compiles 1, deopts 1
 *   deopt at 6: interp 7, compiled 1, compiles 1, deopts 1
 *               last note "interp 7, compiled 1, deopts 1." stamp "deopt"
 *   deopt at 8: interp 5, compiled 3, compiles 1, deopts 1
 *
 * The deopt iteration itself counts as interpreted. Seed is ignored: a
 * type fail is the reader's choice, not a scheduler.
 *
 * MODELLING NOTE, and its limits. No inline caches, no OSR, no
 * recompile. A real JIT may specialize again after a deopt. The
 * argument is the fallback, counted per iteration.
 */

const CODE = [
  "interp the loop",
  "compile after 4",
  "run compiled",
  "type fail: deopt",
];

export const deoptimizationAlgo: AlgoDef<JitState, number> = {
  id: "deoptimization",
  title: "deopt",
  code: CODE,
  counters: [
    { key: JIT_COUNTERS.interpreted, label: "interpreted" },
    { key: JIT_COUNTERS.compiled, label: "compiled" },
    { key: JIT_COUNTERS.compiles, label: "compiles" },
    { key: JIT_COUNTERS.deopts, label: "deopts" },
  ],
  size: { label: "deopt at", min: 5, max: 8, default: 6 },
  generateInput: (_rng, size) => size,
  run: (at) => runJit(8, at),
};
