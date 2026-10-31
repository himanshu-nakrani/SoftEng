/**
 * JIT view — a row of loop iterations, each interp, compiled, or deopt.
 *
 * After HOT hits the loop compiles. A later iteration that fails the
 * type assumption falls back to the interpreter.
 */

export type JitTier = "interp" | "compiled" | "deopt";

export interface JitIter {
  n: number;
  tier: JitTier;
  active: boolean;
}

export interface JitState {
  iters: JitIter[];
  stamp: string;
}
