import { GC_COUNTERS, runIncremental } from "@/engine/algo/gc";
import type { AlgoDef } from "@/engine/algo/types";
import type { GcState } from "@/engine/algo/views/gc";

/**
 * Incremental GC — archetype B (`engine: "steps"`).
 *
 * Mark-sweep already walked a live set. This lesson is the pause that walk
 * costs. Four live objects a→b→c→d, rooted at a. Nothing is swept — the
 * heap is all live — so the only number that moves is how long the mutator
 * sits out the mark.
 *
 * Two figures. Stop-the-world marks all four in one pause of 4, 1 slice,
 * last note "One pause of 4.", stamp "pause 4". Incremental takes the
 * budget as the SIZE slider, 1–4, default 1: budget 1 is pause 1, 4
 * slices, stamp "max 1 × 4", note "4 slices, budget 1."; budget 4 is
 * pause 4, 1 slice — the same as STW. pause is the MAX slice, not the
 * total work (budget 3 marks 3 then 1: pause stays 3, slices 2).
 *
 * THE CONTROL IS THE BUDGET on the incremental figure. STW has no slider
 * — there is no slice to size. Seed is ignored: a mark is not a scheduler.
 *
 * MODELLING NOTE, and its limits. Four named objects and a mark cursor.
 * Deliberately absent: a sweep, tri-colour, a mutator writing between
 * slices. Those change floating garbage and barriers. They do not change
 * the argument: the mutator waits for the current slice, not the heap.
 */

const STW_CODE = ["mark all live"];
const INC_CODE = ["yield to mutator", "mark a slice"];

const counters = [
  { key: GC_COUNTERS.pause, label: "pause" },
  { key: GC_COUNTERS.slices, label: "slices" },
  { key: GC_COUNTERS.marked, label: "marked" },
];

/** Stop-the-world mark of the four live objects. No slider. */
export const incrementalGcAlgo: AlgoDef<GcState, boolean> = {
  id: "incremental-gc",
  title: "stop-the-world",
  code: STW_CODE,
  counters,
  generateInput: () => true,
  run: () => runIncremental(true, 1),
};

/** Incremental mark. The slider is the budget: 1 through 4, default 1. */
export const incrementalGcSlicedAlgo: AlgoDef<GcState, number> = {
  id: "incremental-gc-sliced",
  title: "incremental",
  code: INC_CODE,
  counters,
  size: { label: "budget", min: 1, max: 4, default: 1 },
  generateInput: (_rng, size) => size,
  run: (budget) => runIncremental(false, budget),
};
