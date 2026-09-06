import { GC_COUNTERS, runMarkSweep } from "@/engine/algo/gc";
import type { AlgoDef } from "@/engine/algo/types";
import type { GcState } from "@/engine/algo/views/gc";

/**
 * Mark and Sweep — archetype B (`engine: "steps"`).
 *
 * Live is reachable from a root. The collector paints from the roots,
 * then frees everything unmarked. Four heap objects: 0, 1, 2, 3. 0
 * always points at 1.
 *
 * THE CONTROL IS WHICH HEAP. 0 through 2, default 0:
 *
 *   0  root 0, 2 and 3 garbage     → 2 marked, 2 swept
 *   1  unrooted cycle 2↔3          → still 2 marked, 2 swept
 *   2  roots 0 and 2, cycle live   → 4 marked, 0 swept
 *
 * Heap 1 is the contrast with refcount: A↔B then drop both leaked 2
 * because rc stayed 1. Mark-sweep does not count pointers, so an
 * unrooted cycle is unmarked and both get swept.
 *
 * Seed is ignored: a mark walk is not a scheduler.
 *
 * MODELLING NOTE, and its limits. Four named objects, one pointer
 * each. Deliberately absent: an allocator, tri-colour, a concurrent
 * mutator. Those change the pause. They do not change the argument:
 * reachability from a root is the live set.
 */

const CODE = ["mark from roots", "sweep unmarked"];

export const markAndSweepAlgo: AlgoDef<GcState, number> = {
  id: "mark-and-sweep",
  title: "mark then sweep",
  code: CODE,
  counters: [
    { key: GC_COUNTERS.marked, label: "marked" },
    { key: GC_COUNTERS.swept, label: "swept" },
  ],
  size: { label: "heap", min: 0, max: 2, default: 0 },
  generateInput: (_rng, size) => size,
  run: (size) => runMarkSweep(size),
};
