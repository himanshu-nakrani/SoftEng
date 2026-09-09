import type { AlgoStep } from "./types";

/**
 * The authoring verb for archetype B — the discrete-step counterpart to
 * `engine/sim-helpers.ts`.
 *
 * An algorithm's `run` mutates working state and snapshots it at each
 * interesting moment. Doing that by hand invites two bugs that are tedious to
 * find later: a snapshot that aliases live state (so every earlier step
 * mutates when the algorithm advances, and stepping back shows the final
 * frame), and counters that drift out of sync with the frames they label.
 * The recorder owns both.
 *
 * @typeParam S - the view state being recorded.
 *
 * @example
 * const rec = new StepRecorder(() => ({ array: [...a], highlight }));
 * rec.record({ note: "the unsorted input" });
 * rec.bump("comparisons");
 * rec.record({ codeLine: 2 });
 * return rec.steps;
 */
export class StepRecorder<S> {
  private readonly frames: AlgoStep<S>[] = [];
  private readonly totals: Record<string, number> = {};

  /**
   * @param snapshot Called once per `record()`. MUST return a value that will
   *   not be mutated afterwards — copy arrays and objects you keep mutating.
   */
  constructor(private readonly snapshot: () => S) {}

  /** The recorded run. */
  get steps(): AlgoStep<S>[] {
    return this.frames;
  }

  /** Current value of a counter (0 if never bumped). */
  count(key: string): number {
    return this.totals[key] ?? 0;
  }

  /** Increment a running total. Bump BEFORE the record that shows it. */
  bump(key: string, by = 1): void {
    this.totals[key] = (this.totals[key] ?? 0) + by;
  }

  /** Snapshot the current state as one step. */
  record(opts: { codeLine?: number; note?: string } = {}): void {
    this.frames.push({
      state: this.snapshot(),
      codeLine: opts.codeLine,
      note: opts.note,
      // Copied, not referenced: a shared object would make every recorded
      // step show the FINAL counts.
      counters: { ...this.totals },
    });
  }
}
