import { StepRecorder } from "./recorder";
import type { AlgoStep } from "./types";
import type { MutantFrame, MutationState } from "./views/mutation";

/**
 * Archetype D — the test/mutation harness.
 *
 * Like archetype C, not a separate engine: "run each test against each mutant"
 * is a finite list of states, so it rides on archetype B and inherits
 * step-back, scrubbing, and counters.
 *
 * What it exists to teach is the thing coverage cannot show. A suite that
 * executes every line still lets mutants live, and each survivor is a specific,
 * nameable hole: "nothing in this suite would notice if `>` became `>=`".
 * Stepping through the grid turns "my coverage is 100%" into "seven of my
 * twelve mutants survived, and here is the one test that would kill three".
 */

/** A deliberately broken variant of the function under test. */
export interface Mutant<F> {
  id: string;
  /** What changed, in the reader's language ("`>` became `>=`"). */
  label: string;
  /** Line of `def.code` this mutant alters, for the code panel. */
  codeLine?: number;
  fn: F;
}

/** One test. Return false — or throw — to fail. */
export interface SuiteTest<F> {
  name: string;
  run: (fn: F) => boolean;
}

export const MUTATION_COUNTERS = {
  /** Test executions, baseline included. */
  tests: "tests",
  killed: "killed",
  survived: "survived",
} as const;

export interface MutationSuite<F> {
  /** The correct implementation. The suite MUST pass against it. */
  baseline: F;
  mutants: Mutant<F>[];
  tests: SuiteTest<F>[];
}

/**
 * A test fails if it returns false OR throws. Mutants frequently crash rather
 * than return a wrong answer, and a crash is a kill, not an error in the
 * harness.
 */
function passes<F>(test: SuiteTest<F>, fn: F): boolean {
  try {
    return test.run(fn) === true;
  } catch {
    return false;
  }
}

/** Fisher-Yates over a copy, drawing from the run's seeded stream. */
function shuffled<T>(items: T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Run a suite against its mutants, one frame per test execution.
 *
 * Mutant ORDER is seeded, so reseeding reshuffles the narrative without
 * changing the verdict — which mutants survive is a property of the suite, not
 * of the order. Tests run in declared order and stop at the first failure: the
 * first killer is the interesting one, and continuing past it teaches nothing.
 */
export function runMutationSuite<F>(
  suite: MutationSuite<F>,
  rng: () => number,
): AlgoStep<MutationState>[] {
  const testNames = suite.tests.map((t) => t.name);
  const frames = new Map<string, MutantFrame>(
    suite.mutants.map((m) => [
      m.id,
      {
        id: m.id,
        label: m.label,
        codeLine: m.codeLine,
        status: "pending" as const,
        testsRun: 0,
      },
    ]),
  );

  let baselineGreen: boolean | null = null;
  let running: MutationState["running"] = null;
  let lastResult: MutationState["lastResult"] = null;

  const rec = new StepRecorder<MutationState>(() => ({
    baselineGreen,
    tests: [...testNames],
    // Copy each frame: a shared reference would make every recorded step show
    // the final verdicts.
    mutants: suite.mutants.map((m) => ({ ...frames.get(m.id)! })),
    running: running ? { ...running } : null,
    lastResult,
    killed: [...frames.values()].filter((f) => f.status === "killed").length,
    survived: [...frames.values()].filter((f) => f.status === "survived").length,
  }));

  rec.record({ note: "nothing has run yet" });

  /* ---- 1. the baseline must be green, or nothing below means anything ---- */
  for (const test of suite.tests) {
    running = { mutantId: null, testName: test.name };
    const ok = passes(test, suite.baseline);
    lastResult = ok ? "pass" : "fail";
    rec.bump(MUTATION_COUNTERS.tests);
    rec.record({ note: `baseline · ${test.name}: ${ok ? "pass" : "FAIL"}` });
    if (!ok) {
      baselineGreen = false;
      running = null;
      lastResult = null;
      rec.record({
        note: "the suite fails the correct code — fix the suite before reading any mutation score",
      });
      return rec.steps;
    }
  }
  baselineGreen = true;
  running = null;
  lastResult = null;
  rec.record({ note: "baseline green — now break the code on purpose" });

  /* ---- 2. each mutant, until something kills it ---- */
  for (const mutant of shuffled(suite.mutants, rng)) {
    const frame = frames.get(mutant.id)!;
    frame.status = "testing";
    running = null;
    lastResult = null;
    rec.record({ codeLine: mutant.codeLine, note: `mutant · ${mutant.label}` });

    let killedBy: string | undefined;
    for (const test of suite.tests) {
      running = { mutantId: mutant.id, testName: test.name };
      const ok = passes(test, mutant.fn);
      frame.testsRun += 1;
      lastResult = ok ? "pass" : "fail";
      rec.bump(MUTATION_COUNTERS.tests);
      rec.record({
        codeLine: mutant.codeLine,
        note: `${test.name}: ${ok ? "pass" : "caught it"}`,
      });
      if (!ok) {
        killedBy = test.name;
        break;
      }
    }

    frame.status = killedBy ? "killed" : "survived";
    frame.killedBy = killedBy;
    rec.bump(
      killedBy ? MUTATION_COUNTERS.killed : MUTATION_COUNTERS.survived,
    );
    running = null;
    lastResult = null;
    rec.record({
      codeLine: mutant.codeLine,
      note: killedBy
        ? `killed by ${killedBy}`
        : `SURVIVED — no test notices ${mutant.label}`,
    });
  }

  return rec.steps;
}
