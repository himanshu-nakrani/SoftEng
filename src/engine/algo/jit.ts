import { StepRecorder } from "./recorder";
import type { AlgoStep } from "./types";
import type { JitIter, JitState } from "./views/jit";

/**
 * A hot loop. After JIT_HOT interpreted hits the loop compiles; later
 * iterations run compiled. deoptAt, if set, is the 1-based iteration
 * that fails the type assumption and falls back.
 *
 *   iters 4: interp 4, compiles 1, compiled 0
 *   iters 8: interp 4, compiles 1, compiled 4
 *   iters 8 deoptAt 6: interp 7, compiled 1, deopts 1, compiles 1
 *
 * Deliberately absent: inline caches, a real IR, OSR. The argument is
 * when the tier changes, counted per iteration.
 */

export const JIT_COUNTERS = {
  interpreted: "interpreted",
  compiled: "compiled",
  compiles: "compiles",
  deopts: "deopts",
} as const;

export const JIT_HOT = 4;

export function runJit(iters: number, deoptAt: number | null): AlgoStep<JitState>[] {
  const row: JitIter[] = [];
  let stamp: string = "interp";
  let compiled = false;
  const rec = new StepRecorder<JitState>(() => ({
    iters: row.map((x) => ({ ...x })),
    stamp,
  }));

  rec.record({
    note:
      deoptAt === null
        ? `Loop ${iters}. hot=${JIT_HOT}.`
        : `Loop ${iters}. deopt at ${deoptAt}.`,
  });

  for (let i = 1; i <= iters; i++) {
    for (const x of row) x.active = false;
    if (compiled && deoptAt === i) {
      rec.bump(JIT_COUNTERS.deopts);
      rec.bump(JIT_COUNTERS.interpreted);
      compiled = false;
      row.push({ n: i, tier: "deopt", active: true });
      stamp = "deopt";
      rec.record({ codeLine: 3, note: `Deopt at iter ${i}.` });
      continue;
    }
    if (compiled) {
      rec.bump(JIT_COUNTERS.compiled);
      row.push({ n: i, tier: "compiled", active: true });
      stamp = "compiled";
      rec.record({ codeLine: 2, note: `Compiled iter ${i}.` });
      continue;
    }
    rec.bump(JIT_COUNTERS.interpreted);
    row.push({ n: i, tier: "interp", active: true });
    rec.record({ codeLine: 0, note: `Interp iter ${i}.` });
    if (rec.count(JIT_COUNTERS.interpreted) === JIT_HOT && rec.count(JIT_COUNTERS.compiles) === 0) {
      rec.bump(JIT_COUNTERS.compiles);
      compiled = true;
      stamp = "compile";
      rec.record({ codeLine: 1, note: `Compile after ${JIT_HOT} hits.` });
    }
  }

  stamp = compiled
    ? `${rec.count(JIT_COUNTERS.compiled)} compiled`
    : rec.count(JIT_COUNTERS.deopts)
      ? "deopt"
      : `${rec.count(JIT_COUNTERS.interpreted)} interp`;
  rec.record({
    note: `interp ${rec.count(JIT_COUNTERS.interpreted)}, compiled ${rec.count(JIT_COUNTERS.compiled) ?? 0}, deopts ${rec.count(JIT_COUNTERS.deopts) ?? 0}.`,
  });
  return rec.steps;
}
