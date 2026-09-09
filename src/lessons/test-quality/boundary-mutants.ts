import type { AlgoDef } from "@/engine/algo/types";
import {
  MUTATION_COUNTERS,
  runMutationSuite,
  type Mutant,
  type MutationSuite,
} from "@/engine/algo/mutation";
import type { MutationState } from "@/engine/algo/views/mutation";

/**
 * Boundaries and Off-By-One — archetype B (`engine: "steps"`), archetype D
 * producer (`runMutationSuite`) rendered by `MutationView`.
 *
 * The follow-on to Coverage Is Not Correctness. There the survivors were about
 * weak assertions; here the assertions are exact, but the INPUTS never touch the
 * edge. A boundary mutant — `>` slackened to `>=`, `<` to `<=`, an index bound
 * off by one — changes behaviour at exactly one value and nowhere else. A test
 * that samples the middle of a range asserts the right answer and still walks
 * straight past it.
 *
 * The function under test admits a seat number: it is valid when it is at least
 * 1 and strictly below the row capacity. Two edges, `seat >= 1` and
 * `seat < capacity`, and every boundary bug lives on one of them.
 *
 * Both suites run over the SAME baseline and the SAME five mutants and assert
 * exact answers. They differ only in WHERE their inputs sit:
 *
 *   - the far suite tries a comfortable middle seat, a clearly-negative seat and
 *     a seat far above capacity. Every off-by-one is invisible to it.
 *   - the edge suite tries seat 0, seat 1, the last valid seat and the first
 *     invalid one — the four values the boundaries actually turn on.
 *
 * Which mutants survive is a property of the suite, not of the seeded mutant
 * order. The numbers were measured with `buildAlgoSteps` and pinned in
 * `src/lessons/__tests__/testing-claims.test.ts`.
 *
 * Code lines must be <= 27 characters (the `algo integrity` check enforces it).
 */

const CAPACITY = 20;

/** True when `seat` is a bookable seat in a row of `CAPACITY`. Under test. */
type SeatOk = (seat: number) => boolean;

const baseline: SeatOk = (seat) => seat >= 1 && seat < CAPACITY;

const CODE = [
  "seatOk(seat):",
  "  if seat < 1: false",
  "  if seat >= CAP: false",
  "  return true",
];

/**
 * Five boundary mutants over `baseline`, shared by both suites. Each one is
 * wrong at exactly ONE seat value and correct everywhere else.
 */
const mutants: Mutant<SeatOk>[] = [
  {
    // Wrong only at seat 0: baseline rejects it, this accepts it.
    id: "boundary-mutants-ge-to-gt",
    label: "seat >= 1 became seat > 1",
    codeLine: 1,
    fn: (seat) => seat > 1 && seat < CAPACITY,
  },
  {
    // Wrong only at seat CAP: baseline rejects it, this accepts it.
    id: "boundary-mutants-lt-to-le",
    label: "seat < CAP became seat <= CAP",
    codeLine: 2,
    fn: (seat) => seat >= 1 && seat <= CAPACITY,
  },
  {
    // Wrong only at seat 1: baseline accepts it, this rejects it.
    id: "boundary-mutants-lower-off-by-one",
    label: "lower bound off by one (>= 2)",
    codeLine: 1,
    fn: (seat) => seat >= 2 && seat < CAPACITY,
  },
  {
    // Wrong only at seat CAP-1: baseline accepts it, this rejects it.
    id: "boundary-mutants-upper-off-by-one",
    label: "upper bound off by one (< CAP-1)",
    codeLine: 2,
    fn: (seat) => seat >= 1 && seat < CAPACITY - 1,
  },
  {
    // Wrong everywhere the two disagree — a coarse mutant the middle catches.
    id: "boundary-mutants-drop-upper",
    label: "upper bound check removed",
    codeLine: 2,
    fn: (seat) => seat >= 1,
  },
];

/** Exact assertions, but every input sits well away from an edge. */
const farSuite: MutationSuite<SeatOk> = {
  baseline,
  mutants,
  tests: [
    { name: "seat 10 valid", run: (fn) => fn(10) === true },
    { name: "seat -5 invalid", run: (fn) => fn(-5) === false },
    { name: "seat 40 invalid", run: (fn) => fn(40) === false },
  ],
};

/** The SAME assertions style, now placed exactly on the boundaries. */
const edgeSuite: MutationSuite<SeatOk> = {
  baseline,
  mutants,
  tests: [
    { name: "seat 0 invalid", run: (fn) => fn(0) === false },
    { name: "seat 1 valid", run: (fn) => fn(1) === true },
    { name: "seat 19 valid", run: (fn) => fn(CAPACITY - 1) === true },
    { name: "seat 20 invalid", run: (fn) => fn(CAPACITY) === false },
  ],
};

const counters = [
  { key: MUTATION_COUNTERS.tests, label: "tests run" },
  { key: MUTATION_COUNTERS.killed, label: "mutants killed" },
  { key: MUTATION_COUNTERS.survived, label: "survived" },
];

/** Exact assertions, inputs far from the edge — off-by-ones survive. */
export const boundaryMutantsAlgo: AlgoDef<MutationState, MutationSuite<SeatOk>> = {
  id: "boundary-mutants",
  title: "far from the edge",
  code: CODE,
  counters,
  generateInput: () => farSuite,
  run: (suite, rng) => runMutationSuite(suite, rng),
};

/** The same style of assertion, now placed on the boundaries. */
export const boundaryMutantsEdgeAlgo: AlgoDef<MutationState, MutationSuite<SeatOk>> = {
  id: "boundary-mutants-edge",
  title: "on the edge",
  code: CODE,
  counters,
  generateInput: () => edgeSuite,
  run: (suite, rng) => runMutationSuite(suite, rng),
};
