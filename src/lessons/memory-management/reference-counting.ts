import { GC_COUNTERS, runRefcount } from "@/engine/algo/gc";
import type { AlgoDef } from "@/engine/algo/types";
import type { GcState } from "@/engine/algo/views/gc";

/**
 * Reference Counting — archetype B (`engine: "steps"`).
 *
 * An object lives while something points at it. The count is how many
 * pointers currently do; hitting 0 frees it and drops whatever it pointed
 * at. A cycle is two objects each holding the last pointer to the other,
 * so the count never hits 0.
 *
 * THE CONTRAST IS TWO FIGURES, not a slider. Both alloc A and B, then
 * drop both. Acyclic does A.p=B: freed 2, leaked 0, stamp "2 freed",
 * last note "Both freed." Cyclic also does B.p=A: freed 0, leaked 2,
 * stamp "2 leaked", last note "Leaked 2. rc never hit 0." generateInput
 * ignores the seed: a count is not a scheduler.
 *
 * MODELLING NOTE, and its limits. Two named objects, one pointer each.
 * Deliberately absent: a real allocator, Swift ARC, Python's cyclic GC,
 * weak refs. Those change how a runtime papers over the cycle. They do
 * not change the argument: the count only sees local increments and
 * decrements, so a cycle looks live forever.
 */

const CODE = [
  "alloc obj, rc=1",
  "p = other; rc++",
  "if rc==0: free",
  "drop; rc--",
];

const counters = [
  { key: GC_COUNTERS.allocs, label: "allocs" },
  { key: GC_COUNTERS.freed, label: "freed" },
  { key: GC_COUNTERS.leaked, label: "leaked" },
];

/** A.p=B, then drop both. Both counts hit 0. */
export const referenceCountingAlgo: AlgoDef<GcState, boolean> = {
  id: "reference-counting",
  title: "acyclic",
  code: CODE,
  counters,
  generateInput: () => false,
  run: (cyclic) => runRefcount(cyclic),
};

/** A↔B, then drop both. Each stays at rc 1. */
export const referenceCountingCycleAlgo: AlgoDef<GcState, boolean> = {
  id: "reference-counting-cycle",
  title: "cycle",
  code: CODE,
  counters,
  generateInput: () => true,
  run: (cyclic) => runRefcount(cyclic),
};
