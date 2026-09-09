/**
 * The branching-scenario view's state contract — archetype B, for track 11
 * (Engineering Practice).
 *
 * Pure data (no JSX) so a lesson `.ts` file can model an on-call decision
 * without pulling a component into its module graph.
 *
 * WHY A SEPARATE VIEW, AND THE HARD GATE IT ENFORCES. The G gate
 * (implementation_plan.md §3 Phase 2) is blunt: a scenario CHOICE must mutate the
 * parameters of a real A or B run, or the lesson does not ship — a choice that
 * only reveals text is a quiz, and /review already does quizzes better. So this
 * state does NOT carry "the consequence text of the chosen option". It carries
 * the MEASURED outcome of a real sub-run whose parameter the choice set: a
 * distribution of results over many seeds, computed by actually running the
 * simulation. The view draws that measured outcome, and the G spike
 * (`scripts/spike-g-scenario.mts`) is the proof the numbers diverge by choice.
 *
 * WHAT IS MODELLED. A scenario is a prompt, a set of options, and — once one is
 * chosen — the real run its parameter drives, reduced to an outcome the reader
 * can compare against the other options. The reduction (e.g. "correct in N of
 * 200 runs") is computed here, never authored; the alternatives are computed the
 * same way so the contrast is real rather than asserted.
 */

/** One option in a scenario decision. */
export interface ScenarioOption {
  id: string;
  /** The choice as the reader sees it ("Ship it, add a lock later"). */
  label: string;
  /** The measured outcome of the real run this option's parameter drives. */
  outcome: ScenarioOutcome;
  /** True for the option the current step selected. */
  chosen: boolean;
}

/** The measured result of a real sub-run — numbers, not prose. */
export interface ScenarioOutcome {
  /**
   * The headline measured figure ("2 in 49/200 runs"). Read from an actual
   * simulation over many seeds, so it changes with the option's parameter.
   */
  headline: string;
  /**
   * A 0..1 quality score for the option's measured outcome, so the view can draw
   * a comparable bar. Derived from the same measurement as the headline.
   */
  score: number;
  /**
   * A single measured integer the bar is scaled against and the reader can read
   * exactly (e.g. runs that stayed correct out of the sample).
   */
  value: number;
  /** The denominator the value is out of (the sample size). */
  outOf: number;
}

export interface ScenarioState {
  /** The situation, as one or two sentences of setup. */
  prompt: string;
  /** The parameter each option sets on the real run — named so it is not magic. */
  parameter: string;
  options: ScenarioOption[];
  /** The option chosen so far, or null before any choice. */
  chosenId: string | null;
  /**
   * The verdict once a choice is made: what the measured run showed. Absent on
   * the opening frame, present after the choice — the payoff, drawn from data.
   */
  verdict?: string;
  /** The sample size every option's outcome was measured over. */
  sampleSize: number;
}
