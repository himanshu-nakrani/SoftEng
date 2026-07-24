/**
 * Algo engine — the step-through visualizer for array algorithms.
 *
 * Where the packet sim is continuous and forward-only (sim time), an
 * algorithm is a finite list of discrete steps computed up front. That
 * difference buys the interactions sorting wants: step BACK, scrub,
 * and exact operation counts. Determinism is trivial — the step list
 * IS the truth, and inputs come from the same seeded mulberry32.
 */

export interface AlgoHighlight {
  /** Indices being compared this step (cyan). */
  compare?: number[];
  /** Indices being swapped / written (accent). */
  swap?: number[];
  /** Indices settled in their final position (green). */
  sorted?: number[];
  /** Pivot index (violet). */
  pivot?: number;
  /** Active subrange [lo, hi] inclusive — divide & conquer band. */
  range?: [number, number];
}

export interface AlgoStep {
  /** Full array snapshot AFTER this step (n is small; snapshots are cheap). */
  array: number[];
  highlight: AlgoHighlight;
  /** Active pseudocode line (index into AlgoDef.code). */
  codeLine?: number;
  /** Optional caption for this step. */
  note?: string;
  /** Running operation counts. */
  comparisons: number;
  swaps: number;
}

export interface AlgoDef {
  id: string;
  title: string;
  /** Pseudocode shown in the CodePanel. */
  code: string[];
  /** Seeded input generation (values in 5..100 render well as bars). */
  generateInput: (rng: () => number, n: number) => number[];
  /** Precompute every step. First step should be the untouched input. */
  run: (input: number[]) => AlgoStep[];
}

/** Shared input generator: shuffled distinct values, bar-friendly. */
export function shuffledInput(rng: () => number, n: number): number[] {
  const values = Array.from(
    { length: n },
    (_, i) => 8 + Math.round((i * 92) / Math.max(n - 1, 1)),
  );
  for (let i = values.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [values[i], values[j]] = [values[j], values[i]];
  }
  return values;
}
