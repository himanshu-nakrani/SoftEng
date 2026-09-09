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
 * Why Suites Go Flaky — archetype B (`engine: "steps"` in the registry).
 *
 * A flaky test is rarely random. It is ORDER-DEPENDENT: two tests that touch
 * the same mutable thing — a module-level cache, a database row, an env var, a
 * singleton — can both pass in one order and one fail in another. The suite
 * only LOOKS non-deterministic because the runner's order is not something
 * anyone chose or wrote down.
 *
 * That is exactly the situation archetype C already models. `interleave` picks
 * uniformly among runnable threads from a seeded stream, so `(program, seed)`
 * replays one order exactly and reseeding explores other legal ones — precisely
 * a flaky suite's predicament. So each TEST is modelled as a Thread whose ops
 * read and write shared state, and the flake shows up as an interleaving rather
 * than as bad luck.
 *
 * The two tests are the same shape in both defs. Each writes a value it owns,
 * then reads it back and passes only if it sees what it wrote:
 *   - write : cache = MY value
 *   - assert: pass iff cache reads back MY value
 * Test A owns 7, test B owns 3.
 *
 * Shared def: both tests write the SAME slot, `cache`, and neither cleans up.
 * If the two run one-then-the-other (write, assert, write, assert) both pass;
 * if the writes interleave ahead of an assert (write A, write B, assert A) then
 * A reads 3 where it wrote 7 and fails. Whether they collide is purely the
 * order, so reseeding flips the verdict — the flake.
 *
 * Isolated def: each test writes and reads its OWN slot (`cache_a`, `cache_b`)
 * and tears it back down to 0 afterwards. No two tests share a slot, so no
 * order can make one read the other's value — every seed passes. The isolation
 * is not free: it is the extra teardown op on every test, on every run.
 *
 * LIMITS. This is a believable model, not a faithful test runner. Real runners
 * execute a whole test body before the next, so the true hazard is leakage
 * between WHOLE tests, not a mid-assert context switch; interleaving the two
 * tests op-by-op is the exaggeration that puts the hazard on a lane diagram
 * where it can be seen and stepped through. `cache` is a single integer
 * standing in for any shared mutable resource, the assertion is a bare
 * equality, and there is no I/O, no async, and teardown is one op rather than a
 * real fixture. What the model does capture faithfully is the only thing that
 * matters here: shared mutable state makes the verdict a function of an order
 * nobody chose, and giving each test its own state removes the dependence.
 */

/** Line indices into the code panels, named so ops cannot drift from them. */
const LINE = {
  write: 0,
  assert: 1,
  teardown: 2,
} as const;

/**
 * One test. It writes `value` into `slot`, then passes only if it reads `value`
 * back. When `isolated`, it also resets its own slot to 0 (teardown).
 */
function test(
  id: string,
  name: string,
  slot: string,
  value: number,
  isolated: boolean,
): Thread {
  const ops = [
    {
      label: `write ${value} to ${slot}`,
      codeLine: LINE.write,
      effect: (memory: Record<string, number>) => {
        memory[slot] = value;
      },
    },
    {
      label: `expect ${slot} == ${value}`,
      codeLine: LINE.assert,
      effect: (memory: Record<string, number>) => {
        if (memory[slot] === value) memory.passed += 1;
        else memory.failed += 1;
      },
    },
  ];

  const teardown = {
    label: `reset ${slot}`,
    codeLine: LINE.teardown,
    effect: (memory: Record<string, number>) => {
      memory[slot] = 0;
    },
  };

  return { id, name, ops: isolated ? [...ops, teardown] : ops };
}

function program(isolated: boolean): Program {
  const memory: Memory = isolated
    ? { cache_a: 0, cache_b: 0, passed: 0, failed: 0 }
    : { cache: 0, passed: 0, failed: 0 };
  return {
    memory,
    threads: [
      test("test_a", "test A", isolated ? "cache_a" : "cache", 7, isolated),
      test("test_b", "test B", isolated ? "cache_b" : "cache", 3, isolated),
    ],
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
const SHARED_CODE = [
  "cache = mine",
  "expect cache == mine",
];

const ISOLATED_CODE = [
  "cache_x = mine",
  "expect cache_x == mine",
  "cache_x = 0    // teardown",
];

/**
 * Shared state. Two tests, one mutable slot, no cleanup. Run one-then-the-other
 * and both are green; let the writes interleave ahead of an assert and one test
 * reads a value it never wrote. Reseed to flip the verdict — the code never
 * changed, only the order did.
 */
export const flakyTestsAlgo: AlgoDef<ConcurrencyState, Program> = {
  id: "flaky-tests",
  title: "two tests · shared slot",
  code: SHARED_CODE,
  counters,
  generateInput: () => program(false),
  run: (input, rng) => interleave(input, rng),
};

/**
 * Isolated. The same two tests, each writing and reading its OWN slot and
 * resetting it afterwards. No order can make one test read the other's value,
 * so every seed passes — paid for with a teardown op per test on every run.
 */
export const flakyTestsIsolatedAlgo: AlgoDef<ConcurrencyState, Program> = {
  id: "flaky-tests-isolated",
  title: "two tests · isolated slots",
  code: ISOLATED_CODE,
  counters,
  generateInput: () => program(true),
  run: (input, rng) => interleave(input, rng),
};
