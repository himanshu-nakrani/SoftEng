import {
  CONCURRENCY_COUNTERS,
  interleave,
  type Memory,
  type Program,
  type Thread,
} from "@/engine/algo/concurrency";
import type { AlgoDef } from "@/engine/algo/types";
import type { ConcurrencyState } from "@/engine/algo/views/threads";

/**
 * Tests That Depend on Each Other — archetype B (`engine: "steps"` in the
 * registry), archetype C producer (`interleave`) rendered by `ThreadsView`.
 *
 * The counterpart to Why Suites Go Flaky. There the two tests were SYMMETRIC:
 * each wrote its own value into one shared slot, and a collision made a test
 * read a value it never wrote. The bug was mutual interference, and the fix was
 * a slot per test.
 *
 * This lesson is the ASYMMETRIC case, and it is a different smell. One test
 * SEEDS shared state and another silently RELIES on it — the second does no
 * setup of its own, so it passes only when the first happens to run before it.
 * The tests are not fighting over a slot; one is quietly leaning on the other's
 * side effect. That is test pollution: a green suite whose greenness is an
 * accident of order, and the classic trap is that it hides until someone runs
 * the depending test alone (in isolation, or first) and it fails for no reason
 * they changed.
 *
 * Both defs model the same pair of tests against a shared users table:
 *   - test A inserts a row, then asserts the table is non-empty. It is
 *     self-contained: it passes in every order.
 *   - test B asserts the table is non-empty. In the polluted def it does NO
 *     setup — it only passes if A's insert already landed.
 *
 * Polluted def: B has a single op, its assertion. If it runs before A's insert
 * it reads an empty table and fails; if A went first it passes. Whether it
 * collides is purely the order, so reseeding flips the verdict — the flake. The
 * dependence is invisible in the code B: nothing there says "A must run first".
 *
 * Isolated def: B does its OWN setup first — it inserts a row before asserting —
 * so it no longer depends on A at all. Every order passes. The isolation is not
 * free: it is the extra setup op on B, on every run.
 *
 * MEASURED (via `buildAlgoSteps`, pinned in
 * `src/lessons/__tests__/flakiness-claims.test.ts`): the polluted def leaves B
 * failing in about half of the orders (101 of the first 200 seeds, 495 of the
 * first 1000); the isolated def fails in 0 of 1000. Seed 42 is a failing order;
 * seed 0 is a passing one. The extra setup takes the run from three steps to
 * four.
 *
 * LIMITS. Same modelling honesty as the sibling lesson. A real runner executes a
 * whole test body before the next, so the true hazard is leakage between WHOLE
 * tests; interleaving them op-by-op is the exaggeration that puts the order on a
 * lane diagram. `users` is a single integer standing in for any shared fixture
 * (a database row, a temp file, a cache entry, a logged-in session), the
 * assertion is a bare non-emptiness check, and "setup" is one op rather than a
 * real fixture. What the model captures faithfully is the only thing that
 * matters here: a test that reads shared state it did not set up has a verdict
 * that depends on an order nobody wrote down, and doing its own setup removes
 * the dependence.
 *
 * Code lines must be <= 27 characters (the `algo integrity` check enforces it).
 */

/** Line indices into the code panels, named so ops cannot drift from them. */
const LINE = {
  insert: 0,
  assert: 1,
} as const;

/** Insert a row into the shared table. */
function insert(label: string) {
  return {
    label,
    codeLine: LINE.insert,
    effect: (memory: Memory) => {
      memory.users += 1;
    },
  };
}

/** Pass iff the shared table has at least one row. */
const assertNonEmpty = {
  label: "expect users >= 1",
  codeLine: LINE.assert,
  effect: (memory: Memory) => {
    if (memory.users >= 1) memory.passed += 1;
    else memory.failed += 1;
  },
};

/** The self-contained test: it seeds a row, then checks the table is non-empty. */
function seedingTest(): Thread {
  return {
    id: "test_a",
    name: "test A · seeds a row",
    ops: [insert("insert a user"), assertNonEmpty],
  };
}

/**
 * The dependent test: it checks the table is non-empty. When `isolated` it does
 * its own setup first; otherwise it leans on whatever ran before it.
 */
function countingTest(isolated: boolean): Thread {
  return {
    id: "test_b",
    name: "test B · counts users",
    ops: isolated
      ? [insert("insert own user"), assertNonEmpty]
      : [assertNonEmpty],
  };
}

function program(isolated: boolean): Program {
  const memory: Memory = { users: 0, passed: 0, failed: 0 };
  return {
    memory,
    threads: [seedingTest(), countingTest(isolated)],
  };
}

/** Counter keys are the scheduler's; the labels give them domain meaning. */
const counters = [
  { key: CONCURRENCY_COUNTERS.steps, label: "test steps run" },
  { key: CONCURRENCY_COUNTERS.switches, label: "order changes" },
];

/**
 * Pseudocode for the panels. Every line is within the 27-character budget the
 * `algo integrity` check enforces.
 */
const POLLUTED_CODE = [
  "insert a user",
  "expect users >= 1",
];

const ISOLATED_CODE = [
  "insert own user  // setup",
  "expect users >= 1",
];

/**
 * Polluted. Test B does no setup and only asserts the table is non-empty, so it
 * passes only when test A's insert happens to run first. Whether it does is the
 * order alone, so reseeding flips the verdict — the flake, and the code B never
 * says it depends on A.
 */
export const testPollutionAlgo: AlgoDef<ConcurrencyState, Program> = {
  id: "test-pollution",
  title: "test B leans on test A",
  code: POLLUTED_CODE,
  counters,
  generateInput: () => program(false),
  run: (input, rng) => interleave(input, rng),
};

/**
 * Isolated. Test B inserts its own row before asserting, so it no longer
 * depends on test A at all. Every order passes — paid for with one extra setup
 * op on B on every run.
 */
export const testPollutionIsolatedAlgo: AlgoDef<ConcurrencyState, Program> = {
  id: "test-pollution-isolated",
  title: "test B sets up its own",
  code: ISOLATED_CODE,
  counters,
  generateInput: () => program(true),
  run: (input, rng) => interleave(input, rng),
};
