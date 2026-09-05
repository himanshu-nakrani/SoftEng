import type { AlgoDef } from "@/engine/algo/types";
import {
  MUTATION_COUNTERS,
  runMutationSuite,
  type Mutant,
  type MutationSuite,
} from "@/engine/algo/mutation";
import type { MutationState } from "@/engine/algo/views/mutation";

/**
 * Brittle Mocks vs State Verification — archetype B (`engine: "steps"`),
 * archetype D producer (`runMutationSuite`) rendered by `MutationView`.
 *
 * Mock-heavy unit testing asserts how code executes: the exact number of helper
 * calls, argument sequences, and call order. State verification asserts what the
 * code produces: the final returned value and observable side effects.
 *
 * This lesson demonstrates the twin failures of interaction testing:
 *
 *   1. False Positives (Fragility): an internal refactoring that reorganizes or
 *      batches helper calls breaks mock assertions, even though the return value
 *      and business contract remain 100% correct.
 *   2. False Negatives (Blind Spots): a mock suite that only verifies that
 *      spies were invoked sleeps through real calculation bugs where the return
 *      value is corrupted.
 *
 * Both suites run over the SAME order total calculation and the SAME six mutants:
 * three safe internal refactorings and three real arithmetic bugs.
 *
 * Code lines must be <= 27 characters (enforced by check-curriculum).
 */

export interface EventBus {
  emit: (event: string) => void;
}

export type OrderFn = (amt: number, fee: number, bus?: EventBus) => number;

export const baseline: OrderFn = (amt, fee, bus) => {
  bus?.emit("validate");
  bus?.emit("charge");
  bus?.emit("record");
  return amt + fee;
};

export const CODE = [
  "order(amt, fee, bus):",
  "  bus.emit('validate')",
  "  bus.emit('charge')",
  "  bus.emit('record')",
  "  return amt + fee",
];

export const mutants: Mutant<OrderFn>[] = [
  {
    id: "bm-refactor-omit-validate",
    label: "refactor: omit redundant validate",
    codeLine: 1,
    fn: (amt, fee, bus) => {
      bus?.emit("charge");
      bus?.emit("record");
      return amt + fee;
    },
  },
  {
    id: "bm-refactor-batch",
    label: "refactor: batch charge and record",
    codeLine: 2,
    fn: (amt, fee, bus) => {
      bus?.emit("validate");
      bus?.emit("processed");
      return amt + fee;
    },
  },
  {
    id: "bm-refactor-reorder",
    label: "refactor: charge before validate",
    codeLine: 1,
    fn: (amt, fee, bus) => {
      bus?.emit("charge");
      bus?.emit("validate");
      bus?.emit("record");
      return amt + fee;
    },
  },
  {
    id: "bm-bug-subtract",
    label: "bug: subtract fee instead of add",
    codeLine: 4,
    fn: (amt, fee, bus) => {
      bus?.emit("validate");
      bus?.emit("charge");
      bus?.emit("record");
      return amt - fee;
    },
  },
  {
    id: "bm-bug-omit-fee",
    label: "bug: fee dropped from total",
    codeLine: 4,
    fn: (amt, fee, bus) => {
      bus?.emit("validate");
      bus?.emit("charge");
      bus?.emit("record");
      return amt;
    },
  },
  {
    id: "bm-bug-double-fee",
    label: "bug: fee doubled in total",
    codeLine: 4,
    fn: (amt, fee, bus) => {
      bus?.emit("validate");
      bus?.emit("charge");
      bus?.emit("record");
      return amt + fee * 2;
    },
  },
];

/**
 * Mock suite: asserts exact spy call counts, event names, and order.
 * Fails on safe refactors; sleeps through calculation bugs.
 */
export const mockSuite: MutationSuite<OrderFn> = {
  baseline,
  mutants,
  tests: [
    {
      name: "spy: exact 3 events emitted",
      run: (fn) => {
        const events: string[] = [];
        fn(100, 10, { emit: (e) => events.push(e) });
        return events.length === 3;
      },
    },
    {
      name: "spy: validate called first",
      run: (fn) => {
        const events: string[] = [];
        fn(100, 10, { emit: (e) => events.push(e) });
        return events[0] === "validate";
      },
    },
    {
      name: "spy: charge called second",
      run: (fn) => {
        const events: string[] = [];
        fn(100, 10, { emit: (e) => events.push(e) });
        return events[1] === "charge";
      },
    },
    {
      name: "spy: record called third",
      run: (fn) => {
        const events: string[] = [];
        fn(100, 10, { emit: (e) => events.push(e) });
        return events[2] === "record";
      },
    },
  ],
};

/**
 * State suite: asserts the external return value contract.
 * Green on safe refactors; catches all calculation bugs.
 */
export const stateSuite: MutationSuite<OrderFn> = {
  baseline,
  mutants,
  tests: [
    {
      name: "100 + 10 fee is 110",
      run: (fn) => fn(100, 10) === 110,
    },
    {
      name: "50 + 5 fee is 55",
      run: (fn) => fn(50, 5) === 55,
    },
    {
      name: "200 + 0 fee is 200",
      run: (fn) => fn(200, 0) === 200,
    },
    {
      name: "0 + 15 fee is 15",
      run: (fn) => fn(0, 15) === 15,
    },
  ],
};

const counters = [
  { key: MUTATION_COUNTERS.tests, label: "tests run" },
  { key: MUTATION_COUNTERS.killed, label: "mutants killed" },
  { key: MUTATION_COUNTERS.survived, label: "survived" },
];

export const brittleMocksMockAlgo: AlgoDef<MutationState, MutationSuite<OrderFn>> = {
  id: "brittle-mocks",
  title: "mock-heavy suite (coupled to calls)",
  code: CODE,
  counters,
  generateInput: () => mockSuite,
  run: (suite, rng) => runMutationSuite(suite, rng),
};

export const brittleMocksStateAlgo: AlgoDef<MutationState, MutationSuite<OrderFn>> = {
  id: "brittle-mocks-state",
  title: "state verification suite",
  code: CODE,
  counters,
  generateInput: () => stateSuite,
  run: (suite, rng) => runMutationSuite(suite, rng),
};
