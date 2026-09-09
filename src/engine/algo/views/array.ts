/**
 * The array view's state contract.
 *
 * Array-specific by design: `AlgoHighlight` indexes POSITIONS, which means
 * nothing to a tree or a page cache. Each view owns its own state shape and
 * its own highlight vocabulary; the engine only moves them around.
 *
 * Pure data (no JSX) so lesson `.ts` files can import it without pulling a
 * component into their module graph.
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

/** What `ArrayView` draws. */
export interface ArrayAlgoState {
  array: number[];
  highlight: AlgoHighlight;
}

/** Shared input generator: shuffled distinct values, bar-friendly (8..100). */
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
