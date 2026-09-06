import {
  PAGING_COUNTERS,
  runPaging,
  type PagingConfig,
} from "@/engine/algo/paging";
import type { AlgoDef } from "@/engine/algo/types";
import type { PagingState } from "@/engine/algo/views/paging";

/**
 * The TLB — archetype B (`engine: "steps"`).
 *
 * A two-level walk is two page-table references, paid on every translation.
 * Repeating the same VPN does not help: eight accesses of page 0 cost sixteen
 * table refs. A TLB is a fully-associative FIFO of recent VPN→PFN mappings.
 * A hit skips the walk. Measured: three repeats of VPN 0 with a TLB of 4 cost
 * 1 miss, 2 hits, and 2 table refs; eight repeats cost 1 miss, 7 hits, and
 * still 2 table refs. The same eight with the TLB disabled cost 16 table refs
 * and zero hits — there is no cache, so there is nothing to hit or miss.
 *
 * THE CONTROL IS HOW MANY TIMES VPN 0 IS ACCESSED. Every extra access is two
 * more table refs without a TLB, and one more hit with one. The range starts
 * at 3 so the first position already shows hits (the known measurement) and
 * stops at 8 so the meters read 16 against 2.
 *
 * MODELLING NOTE, and its limits. The TLB is fully-associative FIFO. There is
 * no ASID/PCID, so a context switch is not modelled — the figure will not
 * flush. Demand paging and replacement are off; this lesson is the hit, not
 * the fault. A walk is one frame that costs two table refs, not two frames.
 */

const CODE = [
  "hit: skip the walk",
  "walk dir then table",
];

const counters = [
  { key: PAGING_COUNTERS.walks, label: "table refs" },
  { key: PAGING_COUNTERS.tlbHits, label: "tlb hits" },
  { key: PAGING_COUNTERS.tlbMisses, label: "tlb misses" },
];

const sizeControl = {
  label: "repeated accesses",
  min: 3,
  max: 8,
  default: 8,
};

function cfg(tlbSize: number, n: number): PagingConfig {
  return {
    tlbSize,
    frames: 4,
    replacement: "none",
    demand: false,
    accesses: Array.from({ length: n }, () => 0),
  };
}

/** No cache: every translation walks, and there is nothing to hit. */
export const tlbNoneAlgo: AlgoDef<PagingState, PagingConfig> = {
  id: "tlb-none",
  title: "no tlb",
  code: CODE,
  counters,
  size: sizeControl,
  generateInput: (_rng, size) => cfg(0, size),
  run: (input) => runPaging(input),
};

/** A four-entry fully-associative FIFO. A hit skips the walk. */
export const tlbAlgo: AlgoDef<PagingState, PagingConfig> = {
  id: "tlb",
  title: "tlb of 4",
  code: CODE,
  counters,
  size: sizeControl,
  generateInput: (_rng, size) => cfg(4, size),
  run: (input) => runPaging(input),
};
