import type { AlgoDef } from "@/engine/algo/types";
import {
  MUTATION_COUNTERS,
  runMutationSuite,
  type Mutant,
  type MutationSuite,
} from "@/engine/algo/mutation";
import type { MutationState } from "@/engine/algo/views/mutation";

/**
 * Assertion-Free Tests — archetype B (`engine: "steps"`), archetype D
 * producer (`runMutationSuite`) rendered by `MutationView`.
 *
 * Smoke suites and assertion-free test runs execute code to prove that it boots
 * or does not crash. When coupled with line-coverage tools, they often report
 * 100% line coverage because every line was visited during execution.
 *
 * This lesson demonstrates why 100% line coverage without assertions is illusory.
 * Both suites run over the SAME shipping rate calculation and the SAME six
 * mutants, executing every single line:
 *
 *   - the smoke suite calls the function on four valid inputs without asserting
 *     anything about the returned fee. It only kills mutants that throw an
 *     unexpected error or crash. All four calculation mutants survive untouched.
 *   - the asserted suite checks the exact fee for each input. Identical line
 *     coverage, but every mutant is caught and killed.
 *
 * Code lines must be <= 27 characters (enforced by check-curriculum).
 */

/** Calculate shipping fee in dollars. The function under test. */
export type ShippingFn = (weight: number, express: boolean) => number;

export const baseline: ShippingFn = (weight, express) => {
  if (weight <= 0) throw new Error("invalid weight");
  let fee = weight * 2;
  if (express) fee += 15;
  return fee;
};

export const CODE = [
  "shipping(wt, express):",
  "  if wt <= 0: throw Err",
  "  fee = wt * 2",
  "  if express: fee += 15",
  "  return fee",
];

export const mutants: Mutant<ShippingFn>[] = [
  {
    id: "aft-crash-always",
    label: "throws on all inputs",
    codeLine: 0,
    fn: () => {
      throw new Error("crash");
    },
  },
  {
    id: "aft-crash-express",
    label: "express throws an error",
    codeLine: 3,
    fn: (weight, express) => {
      if (weight <= 0) throw new Error("invalid weight");
      const fee = weight * 2;
      if (express) throw new Error("express failed");
      return fee;
    },
  },
  {
    id: "aft-rate-double",
    label: "rate doubled: wt * 4",
    codeLine: 2,
    fn: (weight, express) => {
      if (weight <= 0) throw new Error("invalid weight");
      let fee = weight * 4;
      if (express) fee += 15;
      return fee;
    },
  },
  {
    id: "aft-surcharge-double",
    label: "express surcharge is 30",
    codeLine: 3,
    fn: (weight, express) => {
      if (weight <= 0) throw new Error("invalid weight");
      let fee = weight * 2;
      if (express) fee += 30;
      return fee;
    },
  },
  {
    id: "aft-invert-express",
    label: "surcharge on standard only",
    codeLine: 3,
    fn: (weight, express) => {
      if (weight <= 0) throw new Error("invalid weight");
      let fee = weight * 2;
      if (!express) fee += 15;
      return fee;
    },
  },
  {
    id: "aft-always-free",
    label: "fee is always 0",
    codeLine: 4,
    fn: (weight) => {
      if (weight <= 0) throw new Error("invalid weight");
      return 0;
    },
  },
];

/**
 * Smoke suite: exercises the code across four scenarios without asserting
 * anything about the return value.
 */
export const smokeSuite: MutationSuite<ShippingFn> = {
  baseline,
  mutants,
  tests: [
    {
      name: "smoke: standard 5kg",
      run: (fn) => {
        fn(5, false);
        return true;
      },
    },
    {
      name: "smoke: express 5kg",
      run: (fn) => {
        fn(5, true);
        return true;
      },
    },
    {
      name: "smoke: heavy 20kg",
      run: (fn) => {
        fn(20, false);
        return true;
      },
    },
    {
      name: "smoke: heavy express",
      run: (fn) => {
        fn(20, true);
        return true;
      },
    },
  ],
};

/**
 * Asserted suite: runs the same inputs, but asserts the exact expected dollar fee.
 */
export const assertedSuite: MutationSuite<ShippingFn> = {
  baseline,
  mutants,
  tests: [
    { name: "5kg standard is $10", run: (fn) => fn(5, false) === 10 },
    { name: "5kg express is $25", run: (fn) => fn(5, true) === 25 },
    { name: "20kg standard is $40", run: (fn) => fn(20, false) === 40 },
    { name: "20kg express is $55", run: (fn) => fn(20, true) === 55 },
  ],
};

const counters = [
  { key: MUTATION_COUNTERS.tests, label: "tests run" },
  { key: MUTATION_COUNTERS.killed, label: "mutants killed" },
  { key: MUTATION_COUNTERS.survived, label: "survived" },
];

/** The smoke suite: 100% line coverage, 0 assertions on return value. */
export const assertionFreeTestsSmokeAlgo: AlgoDef<
  MutationState,
  MutationSuite<ShippingFn>
> = {
  id: "assertion-free-tests",
  title: "smoke suite (no assertions)",
  code: CODE,
  counters,
  generateInput: () => smokeSuite,
  run: (suite, rng) => runMutationSuite(suite, rng),
};

/** The asserted suite: verifies return values. */
export const assertionFreeTestsAssertedAlgo: AlgoDef<
  MutationState,
  MutationSuite<ShippingFn>
> = {
  id: "assertion-free-tests-asserted",
  title: "asserted suite",
  code: CODE,
  counters,
  generateInput: () => assertedSuite,
  run: (suite, rng) => runMutationSuite(suite, rng),
};
