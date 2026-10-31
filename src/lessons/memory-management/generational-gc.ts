import { GC_COUNTERS, runGenerational } from "@/engine/algo/gc";
import type { AlgoDef } from "@/engine/algo/types";
import type { GcState } from "@/engine/algo/views/gc";

/**
 * Generational GC — archetype B (`engine: "steps"`).
 *
 * Most objects die young, so a collector can scan only the young
 * generation — a minor GC — if it also sees every old-to-young pointer.
 * Those pointers are not in the young heap. A write barrier records them
 * as dirty cards.
 *
 * Heap: Y0 (young, rooted), Y1 (young), O0 (old, rooted). THE CONTROL IS
 * WHETHER O0 POINTS AT Y1. 0 = no store, 1 = O0.p = Y1, default 1.
 *
 * Two figures, same slider:
 *   no barrier — runGenerational(false, size===1)
 *   barrier    — runGenerational(true,  size===1)
 *
 * Measured:
 *   no barrier, size 1: lost 1, swept 1, stamp "lost Y1",
 *     note "Y1 was live and got swept."
 *   barrier, size 1: lost 0, cards 1, marked 2, swept 0, stamp "held",
 *     note "Young live set held."
 *   no barrier, size 0: lost 0, swept 1 (Y1 garbage),
 *     note "Y1 was garbage and got swept."
 *
 * Seed is ignored: a collector is not a scheduler.
 *
 * MODELLING NOTE, and its limits. One old object, one card, one store.
 * Deliberately absent: promotion, tri-colour, remembered sets beyond one
 * card, a real allocator. Those change how you find the cards. They do
 * not change the argument: a minor GC that misses an old-to-young store
 * will sweep a live young object.
 */

const NO_BARRIER_CODE = [
  "O0.p = Y1",
  "mark young roots",
  "sweep unmarked",
];

const BARRIER_CODE = [
  "O0.p = Y1; dirty O0",
  "mark young + cards",
  "sweep unmarked",
];

const counters = [
  { key: GC_COUNTERS.lost, label: "lost" },
  { key: GC_COUNTERS.swept, label: "swept" },
  { key: GC_COUNTERS.cards, label: "cards" },
  { key: GC_COUNTERS.marked, label: "marked" },
];

const sizeControl = {
  label: "old-to-young",
  min: 0,
  max: 1,
  default: 1,
} as const;

function def(
  id: string,
  title: string,
  barrier: boolean,
  code: string[],
): AlgoDef<GcState, boolean> {
  return {
    id,
    title,
    code,
    counters,
    size: sizeControl,
    generateInput: (_rng, size) => size === 1,
    run: (oldToYoung) => runGenerational(barrier, oldToYoung),
  };
}

/** Minor GC with no write barrier. An old-to-young store is invisible. */
export const generationalGcAlgo = def(
  "generational-gc",
  "no barrier",
  false,
  NO_BARRIER_CODE,
);

/** The same store, with a write barrier that dirties card O0. */
export const generationalGcBarrierAlgo = def(
  "generational-gc-barrier",
  "barrier",
  true,
  BARRIER_CODE,
);
