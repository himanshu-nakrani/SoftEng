/**
 * Algo engine — the step-through player for discrete algorithms.
 *
 * Where the packet sim is continuous and forward-only (sim time), an
 * algorithm is a finite list of discrete steps computed up front. That
 * difference buys the interactions stepping wants: step BACK, scrub, and
 * exact operation counts. Determinism is trivial — the step list IS the
 * truth, and inputs come from the same seeded mulberry32.
 *
 * The engine is deliberately ignorant of WHAT it is stepping through. A step
 * carries an opaque `state`, and a view component knows how to draw it. That
 * is the whole seam: sorting bars, a B-tree, a WAL replay, a scheduler's run
 * queue, and a parser's stack are all "a list of states with counters".
 *
 * Layering, same as archetype A: an `AlgoDef` is PURE DATA (no JSX, no React)
 * and lives with the lesson; the view component and the figure live here and
 * are wired together by the lesson's `-figure.tsx` client wrapper.
 */

/** A named running total, shown as a meter under the stage. */
export interface AlgoCounter {
  /** Key into `AlgoStep.counters`. */
  key: string;
  /** Meter label, lower case ("comparisons", "disk reads"). */
  label: string;
}

/** The input-size control. Omit to hide it (fixed-input algorithms). */
export interface AlgoSizeControl {
  /** Slider label ("array size", "keys inserted"). */
  label: string;
  min: number;
  max: number;
  /** Starting value; the figure's `defaultSize` prop overrides it. */
  default: number;
}

/**
 * One frame of the run.
 *
 * `state` is whatever the view needs — the engine never inspects it, so it
 * may be as large as it likes, but note the whole list is held in memory:
 * snapshot cheaply (structural sharing) for long runs.
 */
export interface AlgoStep<S> {
  state: S;
  /** Active pseudocode line (index into `AlgoDef.code`). */
  codeLine?: number;
  /** Caption for this step. */
  note?: string;
  /**
   * Running totals as of this step, keyed by `AlgoDef.counters[].key`.
   * Monotonic non-decreasing by convention — they are cumulative counts, and
   * a counter that goes down while stepping forward reads as a bug.
   */
  counters: Record<string, number>;
}

/**
 * An algorithm, as data.
 *
 * @typeParam S - the per-step state its view draws.
 * @typeParam I - the generated input `run` consumes.
 */
export interface AlgoDef<S, I = unknown> {
  /** Stable id; also the figure's plate stamp. */
  id: string;
  title: string;
  /** Pseudocode shown in the CodePanel, one entry per line. */
  code: string[];
  /** Which running totals to surface, in display order. */
  counters: AlgoCounter[];
  size?: AlgoSizeControl;
  /** Seeded input generation — the ONLY randomness allowed. */
  generateInput: (rng: () => number, size: number) => I;
  /**
   * Precompute every step. The first step must be the untouched input, so
   * scrubbing to 0 always shows where the run started.
   *
   * `rng` is the SAME seeded stream `generateInput` drew from, continued — so
   * a run may make its own choices (which thread the scheduler picks, a
   * randomized pivot, a probe sequence) and still be perfectly reproducible
   * from `(def, size, seed)`. Pure algorithms simply ignore it.
   */
  run: (input: I, rng: () => number) => AlgoStep<S>[];
}

/**
 * An `AlgoDef` with its state type erased — for components that hold a def
 * without drawing it (the transport, the code panel, a registry).
 */
export type AlgoDefView = AlgoDef<unknown, unknown>;
