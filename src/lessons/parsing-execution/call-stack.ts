import { RUNTIME_COUNTERS, runCallStack } from "@/engine/algo/runtime";
import type { AlgoDef } from "@/engine/algo/types";
import type { RuntimeState } from "@/engine/algo/views/runtime";

/**
 * The Call Stack — archetype B (`engine: "steps"`).
 *
 * f(n) = n==0 ? 1 : n * f(n-1). Each call is a frame. THE CONTROL IS n.
 * 0–4, default 3. Cap 4 frames. f(3) returns 6 at depth 4, pushes 4,
 * overflow 0. f(4) overflows at f(0) — the fifth frame, and there is no
 * fifth slot — result null, overflow 1, then Unwind f(1) through f(4).
 * f(0) is the base: result 1, depth 1, overflow 0.
 *
 * Seed is ignored: a call stack is not a scheduler.
 *
 * MODELLING NOTE, and its limits. Locals besides n, closures, a real ISA,
 * and a realistic stack size are absent. The cap is 4 so overflow is a
 * slider stop, not a thousand-frame run. The argument is the count: each
 * call is a frame, and unbounded recursion is a finite cap, not a loop.
 */

const CODE = [
  "enter f(n)",
  "n==0: return 1",
  "return n * f(n-1)",
  "overflow",
];

export const callStackAlgo: AlgoDef<RuntimeState, number> = {
  id: "call-stack",
  title: "f of n",
  code: CODE,
  counters: [
    { key: RUNTIME_COUNTERS.pushes, label: "pushes" },
    { key: RUNTIME_COUNTERS.depth, label: "depth" },
    { key: RUNTIME_COUNTERS.overflow, label: "overflow" },
  ],
  size: { label: "n", min: 0, max: 4, default: 3 },
  generateInput: (_rng, size) => size,
  run: (n) => runCallStack(n),
};
