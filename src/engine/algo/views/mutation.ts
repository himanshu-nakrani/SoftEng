/**
 * The mutation-harness view's state contract — archetype D's frame.
 *
 * Pure data (no JSX) so lesson `.ts` files can build suites against it without
 * pulling a component into their module graph.
 */

export type MutantStatus = "pending" | "testing" | "killed" | "survived";

export interface MutantFrame {
  id: string;
  /** What was changed ("`>` became `>=`"). */
  label: string;
  /** Line of the function under test that this mutant alters. */
  codeLine?: number;
  status: MutantStatus;
  /** Name of the test that caught it, if any. */
  killedBy?: string;
  /** How many tests have run against this mutant so far. */
  testsRun: number;
}

export interface MutationState {
  /**
   * Whether the suite passes the UNMUTATED code. `null` until checked. A red
   * baseline invalidates every mutation result, so the run stops there.
   */
  baselineGreen: boolean | null;
  /** Test names, in suite order. */
  tests: string[];
  mutants: MutantFrame[];
  /** What is executing in this frame. */
  running: { mutantId: string | null; testName: string } | null;
  /** Outcome of the test in this frame. */
  lastResult: "pass" | "fail" | null;
  killed: number;
  survived: number;
}
