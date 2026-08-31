/**
 * The refactor-workbench view's state contract — archetype B, for track 10
 * (Software Design & Architecture).
 *
 * Pure data (no JSX) so a lesson `.ts` file can model a refactoring without
 * pulling a component into its module graph.
 *
 * WHY A SEPARATE VIEW. Every other archetype-B view draws a data structure being
 * mutated (an array, a version chain, a lock table, a WAL). This one draws CODE
 * being restructured, and the teaching object is not any single file but the
 * METRICS folded over the whole module — cyclomatic complexity and fan-out
 * coupling, computed FROM the toy AST rather than authored per step. See
 * `algo/refactor.ts` for the metric definitions and the proof they move as a
 * consequence of the transform, not by hand.
 *
 * WHAT IS MODELLED, AND WHAT IS NOT. The AST is a toy: a function is a list of
 * statement nodes over a small set of kinds (branch / loop / boolean operator /
 * switch arm / call / plain), which is exactly enough to define McCabe
 * cyclomatic complexity honestly (1 + decision points) and fan-out (distinct
 * callees). It is deliberately NOT a parser for a real language — there are no
 * expressions, types, or scopes — because the lesson is about how a
 * restructuring MOVES a metric, and a real grammar would add nothing to that
 * argument while hiding it behind noise. The def documents this limit too.
 */

/** The kinds of statement a toy-AST node can be. Drives complexity counting. */
export type RefactorNodeKind =
  | "branch" // if / guard — one decision point
  | "loop" // while / for — one decision point
  | "and" // && — one decision point
  | "or" // || — one decision point
  | "case" // one switch arm — one decision point
  | "call" // a call to another function — a fan-out edge
  | "plain"; // assignment, return, anything with no control flow

/** One line of a function, as the view draws it. */
export interface RefactorLine {
  /** Indentation depth, for drawing nested blocks. */
  depth: number;
  /** The literal source text, drawn as plain SVG text (no markdown). */
  text: string;
  /** The node kind this line represents, so the view can tint decision points. */
  kind: RefactorNodeKind;
  /** For a `call` line, the function it calls — highlighted when it is new. */
  callee?: string;
  /** This line was touched by the transform that produced this frame. */
  touched: boolean;
}

/** One function in the module, with its lines and its computed metrics. */
export interface RefactorFn {
  name: string;
  lines: RefactorLine[];
  /** McCabe cyclomatic complexity, computed from this function's AST. */
  complexity: number;
  /** Fan-out: number of DISTINCT other functions this one calls. */
  fanOut: number;
  /** This function was created or rewritten by the step that produced this frame. */
  changed: boolean;
  /** True for a function that did not exist before this refactoring began. */
  isNew: boolean;
}

export interface RefactorState {
  /** Every function in the module, in display order. */
  fns: RefactorFn[];
  /** The function the current step is focused on (drawn open); others collapse. */
  activeFn: string | null;
  /**
   * Module-level metrics, recomputed each frame from the functions above. The
   * whole point of the view: watch these move as the code is restructured.
   */
  metrics: {
    /** The highest cyclomatic complexity of any one function — the hot spot. */
    maxComplexity: number;
    /** Total decision points across the module (sum of complexity − 1). A pure
     *  extraction MOVES complexity between functions without changing this,
     *  which is the honesty check the producer asserts. */
    totalDecisions: number;
    /** Highest fan-out of any one function. */
    maxFanOut: number;
    /** Number of duplicated blocks still present (call sites an extraction
     *  would collapse). Zero once duplication is removed. */
    duplication: number;
  };
  /** The name of the transform that produced this frame ("Extract Function"). */
  transform?: string;
  /** A one-line verdict for the stage banner ("hot spot: handle, cc 7"). */
  note?: string;
}
