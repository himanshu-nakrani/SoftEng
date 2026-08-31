import type { AlgoDef } from "@/engine/algo/types";
import {
  MUTATION_COUNTERS,
  runMutationSuite,
  type Mutant,
  type MutationSuite,
} from "@/engine/algo/mutation";
import type { MutationState } from "@/engine/algo/views/mutation";

/**
 * Coverage Is Not Correctness — archetype B (`engine: "steps"`), archetype D
 * producer (`runMutationSuite`) rendered by `MutationView`.
 *
 * The function under test grades a numeric score into a band. It is a handful
 * of branches, and a single test that grades one high, one middle and one low
 * score executes every line of it — 100% line coverage, the number a coverage
 * report would print in green.
 *
 * The lesson is that the number is about the tests, not the code. Both suites
 * below run over the SAME baseline and the SAME six mutants, and both reach
 * 100% line coverage. The only difference is what the tests ASSERT:
 *
 *   - the weak suite checks that a grade came back — `typeof result === "string"`
 *     and that it is one of the allowed letters. Every mutant still returns a
 *     letter, so almost nothing is caught.
 *   - the strengthened suite checks that the CORRECT grade came back for each
 *     input. Same coverage, but now a wrong letter is a failure.
 *
 * Which mutants survive is a property of the suite, not of the seeded mutant
 * order — the numbers below were measured with `buildAlgoSteps`, and the claim
 * tests in `src/lessons/__tests__/testing-claims.test.ts` pin them.
 *
 * Code lines must be <= 27 characters (the `algo integrity` check enforces it).
 */

/** Grade a 0–100 score into a band. The function under test. */
type Grade = (score: number) => string;

const baseline: Grade = (score) => {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
};

const CODE = [
  "grade(score):",
  "  if score >= 90: A",
  "  if score >= 80: B",
  "  if score >= 70: C",
  "  if score >= 60: D",
  "  return F",
];

/**
 * Six mutants over `baseline`, shared by both suites. Each changes exactly one
 * decision; every one still returns a letter, so a suite that only checks "a
 * grade came back" cannot tell any of them apart from the original.
 */
const mutants: Mutant<Grade>[] = [
  {
    id: "cvc-a-to-b",
    label: "the A band returns B",
    codeLine: 1,
    fn: (score) => {
      if (score >= 90) return "B";
      if (score >= 80) return "B";
      if (score >= 70) return "C";
      if (score >= 60) return "D";
      return "F";
    },
  },
  {
    id: "cvc-drop-b",
    label: "the B band falls through to C",
    codeLine: 2,
    fn: (score) => {
      if (score >= 90) return "A";
      if (score >= 70) return "C";
      if (score >= 60) return "D";
      return "F";
    },
  },
  {
    id: "cvc-fail-is-d",
    label: "failing scores return D",
    codeLine: 5,
    fn: (score) => {
      if (score >= 90) return "A";
      if (score >= 80) return "B";
      if (score >= 70) return "C";
      if (score >= 60) return "D";
      return "D";
    },
  },
  {
    id: "cvc-c-to-d",
    label: "the C band returns D",
    codeLine: 3,
    fn: (score) => {
      if (score >= 90) return "A";
      if (score >= 80) return "B";
      if (score >= 70) return "D";
      if (score >= 60) return "D";
      return "F";
    },
  },
  {
    id: "cvc-swap-ad",
    label: "top band returns D, bottom A",
    codeLine: 1,
    fn: (score) => {
      if (score >= 90) return "D";
      if (score >= 80) return "B";
      if (score >= 70) return "C";
      if (score >= 60) return "D";
      return "A";
    },
  },
  {
    id: "cvc-always-b",
    label: "always returns B",
    codeLine: 0,
    fn: () => "B",
  },
];

const LETTERS = new Set(["A", "B", "C", "D", "F"]);

/**
 * Every line runs, but the assertion asks nothing of the value beyond "it is a
 * grade". A wrong letter passes.
 */
const weakSuite: MutationSuite<Grade> = {
  baseline,
  mutants,
  tests: [
    { name: "95 → a letter", run: (fn) => LETTERS.has(fn(95)) },
    { name: "85 → a letter", run: (fn) => LETTERS.has(fn(85)) },
    { name: "75 → a letter", run: (fn) => LETTERS.has(fn(75)) },
    { name: "50 → a letter", run: (fn) => LETTERS.has(fn(50)) },
  ],
};

/**
 * The SAME baseline, mutants and inputs — the tests just check the exact grade
 * instead of merely that one came back. Identical line coverage.
 */
const strongSuite: MutationSuite<Grade> = {
  baseline,
  mutants,
  tests: [
    { name: "95 is an A", run: (fn) => fn(95) === "A" },
    { name: "85 is a B", run: (fn) => fn(85) === "B" },
    { name: "75 is a C", run: (fn) => fn(75) === "C" },
    { name: "50 is an F", run: (fn) => fn(50) === "F" },
  ],
};

const counters = [
  { key: MUTATION_COUNTERS.tests, label: "tests run" },
  { key: MUTATION_COUNTERS.killed, label: "mutants killed" },
  { key: MUTATION_COUNTERS.survived, label: "survived" },
];

/** The suite that runs every line and asserts almost nothing. */
export const coverageVsCorrectnessAlgo: AlgoDef<MutationState, MutationSuite<Grade>> = {
  id: "coverage-vs-correctness",
  title: "weak assertions",
  code: CODE,
  counters,
  generateInput: () => weakSuite,
  run: (suite, rng) => runMutationSuite(suite, rng),
};

/** The same coverage, now asking for the right answer. */
export const coverageVsCorrectnessStrengthenedAlgo: AlgoDef<
  MutationState,
  MutationSuite<Grade>
> = {
  id: "coverage-vs-correctness-strengthened",
  title: "exact assertions",
  code: CODE,
  counters,
  generateInput: () => strongSuite,
  run: (suite, rng) => runMutationSuite(suite, rng),
};
