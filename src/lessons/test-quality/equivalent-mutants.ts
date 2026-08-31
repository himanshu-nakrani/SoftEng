import type { AlgoDef } from "@/engine/algo/types";
import {
  MUTATION_COUNTERS,
  runMutationSuite,
  type Mutant,
  type MutationSuite,
} from "@/engine/algo/mutation";
import type { MutationState } from "@/engine/algo/views/mutation";

/**
 * Not Every Survivor Is a Bug — archetype B (`engine: "steps"`), archetype D
 * producer (`runMutationSuite`) rendered by `MutationView`.
 *
 * The counterweight to Coverage Is Not Correctness. That lesson taught that a
 * survivor is a nameable hole — a change no test defends. That is MOSTLY true,
 * and this lesson is the correction: some mutants are semantically identical to
 * the baseline. No input distinguishes them, so no test — not even a perfect
 * one — can ever kill them. They are EQUIVALENT mutants, and they push the
 * mutation score below 100% for a reason no test-writing can fix.
 *
 * The function under test clamps a score into 0–100:
 *
 *   clamp(score) = score < 0 ? 0 : score > 100 ? 100 : score
 *
 * Both defs run over the SAME baseline and the SAME five mutants. Two of the
 * five are equivalent; the other three are real holes:
 *
 *   - eq-lower-le  (score < 0  →  score <= 0): at score 0 the baseline returns
 *     score, which IS 0, so the mutant's early return of 0 gives the same value.
 *     Everywhere else the branch agrees. Equivalent.
 *   - eq-upper-ge  (score > 100  →  score >= 100): at score 100 the baseline
 *     returns score, which IS 100, so the early return of 100 matches.
 *     Equivalent.
 *   - hole-low-val  (return 0  →  return 1): wrong for every score below 0.
 *   - hole-high-val (return 100 → return 99): wrong for every score above 100.
 *   - hole-drop-low (lower clamp removed): wrong for every score below 0.
 *
 * HOW EQUIVALENCE WAS ESTABLISHED. This is not asserted — it was measured. Each
 * mutant was diffed against the baseline over every INTEGER score from -1000 to
 * 2000 (a superset of the 0–100 domain plus wide out-of-range margins); the two
 * eq-* mutants agreed on every one, the three hole-* mutants disagreed on at
 * least 1000. Equivalence is a claim about the domain of interest: over integer
 * scores these two are provably indistinguishable, and the shipped tests pin
 * that they never die under ANY suite here. General equivalence detection is
 * undecidable — you cannot machine-decide it for arbitrary code — so "over this
 * domain, verified by exhaustion" is the honest and strongest thing to say.
 *
 * The partial suite kills 2 of 5 and leaves 3 standing: the 2 equivalent
 * mutants AND 1 real hole (hole-high-val), so ONE grid shows both kinds of
 * survivor. The completed suite kills all 3 holes and plateaus at 3 of 5 — the
 * remaining 2 survivors are the equivalent mutants, and the score cannot rise.
 *
 * Which mutants survive is a property of the suite, not of the seeded mutant
 * order. Numbers were measured with `buildAlgoSteps` and pinned in
 * `src/lessons/__tests__/testing-claims.test.ts`.
 *
 * Code lines must be <= 27 characters (the `algo integrity` check enforces it).
 */

/** Clamp a score into the 0–100 band. The function under test. */
type Clamp = (score: number) => number;

/**
 * Exported so the claims test can diff the equivalent mutants against the REAL
 * baseline over the full integer range — proving equivalence against the code
 * that actually ships, not a copy restated in the test.
 */
export const equivalentMutantsBaseline: Clamp = (score) => {
  if (score < 0) return 0;
  if (score > 100) return 100;
  return score;
};

const baseline = equivalentMutantsBaseline;

const CODE = [
  "clamp(score):",
  "  if score < 0: 0",
  "  if score > 100: 100",
  "  return score",
];

/**
 * Five mutants over `baseline`, shared by both suites. Two are equivalent (no
 * input tells them from the baseline); three are real holes.
 */
const mutants: Mutant<Clamp>[] = [
  {
    // Equivalent: at score 0 the baseline returns score (= 0), so returning 0
    // one branch early changes nothing. Verified over integers -1000..2000.
    id: "equivalent-mutants-eq-lower-le",
    label: "score < 0 became score <= 0",
    codeLine: 1,
    fn: (score) => {
      if (score <= 0) return 0;
      if (score > 100) return 100;
      return score;
    },
  },
  {
    // Equivalent: at score 100 the baseline returns score (= 100), so the early
    // return of 100 matches. Verified over integers -1000..2000.
    id: "equivalent-mutants-eq-upper-ge",
    label: "score > 100 became score >= 100",
    codeLine: 2,
    fn: (score) => {
      if (score < 0) return 0;
      if (score >= 100) return 100;
      return score;
    },
  },
  {
    // Real hole: every score below 0 clamps to 1 instead of 0.
    id: "equivalent-mutants-hole-low-val",
    label: "the low clamp returns 1",
    codeLine: 1,
    fn: (score) => {
      if (score < 0) return 1;
      if (score > 100) return 100;
      return score;
    },
  },
  {
    // Real hole: every score above 100 clamps to 99 instead of 100.
    id: "equivalent-mutants-hole-high-val",
    label: "the high clamp returns 99",
    codeLine: 2,
    fn: (score) => {
      if (score < 0) return 0;
      if (score > 100) return 99;
      return score;
    },
  },
  {
    // Real hole: the lower clamp is gone, so negatives pass through unchanged.
    id: "equivalent-mutants-hole-drop-low",
    label: "the low clamp is removed",
    codeLine: 1,
    fn: (score) => {
      if (score > 100) return 100;
      return score;
    },
  },
];

/**
 * The two mutants claimed to be equivalent, keyed by id — exported so the
 * claims test verifies the SHIPPING fns against the baseline over the full
 * integer range. Reads them out of `mutants` so it cannot drift from the suites.
 */
const EQUIVALENT_IDS = [
  "equivalent-mutants-eq-lower-le",
  "equivalent-mutants-eq-upper-ge",
] as const;

export const equivalentMutantFns: Record<string, Clamp> = Object.fromEntries(
  mutants
    .filter((m) => (EQUIVALENT_IDS as readonly string[]).includes(m.id))
    .map((m) => [m.id, m.fn]),
);

/**
 * A partial suite: checks a middle score and one clamped extreme. It kills two
 * of the three real holes and leaves three survivors — the two equivalent
 * mutants and the one hole it never probes (a score above 100).
 */
const partialSuite: MutationSuite<Clamp> = {
  baseline,
  mutants,
  tests: [
    { name: "50 stays 50", run: (fn) => fn(50) === 50 },
    { name: "-20 clamps to 0", run: (fn) => fn(-20) === 0 },
  ],
};

/**
 * The completed suite: the SAME baseline and mutants, now probing BOTH clamped
 * extremes. It kills all three real holes and plateaus — the two survivors that
 * remain are the equivalent mutants, which no third test could ever kill.
 */
const completeSuite: MutationSuite<Clamp> = {
  baseline,
  mutants,
  tests: [
    { name: "50 stays 50", run: (fn) => fn(50) === 50 },
    { name: "-20 clamps to 0", run: (fn) => fn(-20) === 0 },
    { name: "200 clamps to 100", run: (fn) => fn(200) === 100 },
  ],
};

const counters = [
  { key: MUTATION_COUNTERS.tests, label: "tests run" },
  { key: MUTATION_COUNTERS.killed, label: "mutants killed" },
  { key: MUTATION_COUNTERS.survived, label: "survived" },
];

/** A partial suite: real holes and equivalent mutants survive side by side. */
export const equivalentMutantsAlgo: AlgoDef<MutationState, MutationSuite<Clamp>> = {
  id: "equivalent-mutants",
  title: "a partial suite",
  code: CODE,
  counters,
  generateInput: () => partialSuite,
  run: (suite, rng) => runMutationSuite(suite, rng),
};

/** Every real hole closed; the score plateaus on the equivalent mutants. */
export const equivalentMutantsStrengthenedAlgo: AlgoDef<
  MutationState,
  MutationSuite<Clamp>
> = {
  id: "equivalent-mutants-strengthened",
  title: "every hole closed",
  code: CODE,
  counters,
  generateInput: () => completeSuite,
  run: (suite, rng) => runMutationSuite(suite, rng),
};
