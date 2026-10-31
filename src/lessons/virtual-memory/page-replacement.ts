import {
  PAGING_COUNTERS,
  runPaging,
  type PagingConfig,
  type Replacement,
} from "@/engine/algo/paging";
import type { AlgoDef } from "@/engine/algo/types";
import type { PagingState } from "@/engine/algo/views/paging";

/**
 * Page Replacement — archetype B (`engine: "steps"`).
 *
 * Demand paging filled the frames. The next fault, with nowhere free, has to
 * throw someone out. This lesson is about who, and that the answer is a policy.
 *
 * All three figures run the same five accesses — 0, 1, 2, 0, 3 — under demand
 * paging with the TLB off. Four distinct pages, so three frames is pressure:
 * the fourth page arrives with every frame occupied. FIFO evicts VPN 0 (loaded
 * first, just used). LRU evicts VPN 1 (unused the longest) and keeps 0. CLOCK
 * was measured on the same pattern and matches FIFO: at the first eviction
 * every referenced bit is set, so the hand spends a full circle giving second
 * chances and then picks the oldest anyway. That is not a win. It is what the
 * algorithm actually does here.
 *
 * THE CONTROL IS HOW MANY FRAMES THERE ARE. 2 / 3 / 4 are different pressure:
 * the working set does not fit, the policies split, the working set fits.
 *
 * MODELLING NOTE, and its limits. No TLB, no dirty-bit writeback, no working-
 * set estimator. CLOCK is the referenced-bit sweep in `runPaging`, not a
 * timestamp. Those omissions change constants. They do not change the
 * argument: a victim is a policy, FIFO can throw out a hot page, and CLOCK is
 * an approximation of LRU that has not started approximating yet on a freshly
 * filled set.
 */

const ACCESSES = [0, 1, 2, 0, 3];

const sizeControl = {
  label: "frames",
  min: 2,
  max: 4,
  default: 3,
};

const counters = [
  { key: PAGING_COUNTERS.faults, label: "page faults" },
  { key: PAGING_COUNTERS.evictions, label: "evictions" },
];

function def(
  id: string,
  title: string,
  code: string[],
  replacement: Replacement,
): AlgoDef<PagingState, PagingConfig> {
  return {
    id,
    title,
    code,
    counters,
    size: sizeControl,
    generateInput: (_rng, size) => ({
      tlbSize: 0,
      frames: size,
      replacement,
      demand: true,
      accesses: ACCESSES,
    }),
    run: (input) => runPaging(input),
  };
}

export const fifoAlgo = def(
  "page-replacement",
  "fifo replacement",
  ["check PTE", "walk dir then table", "evict oldest; load"],
  "fifo",
);

export const lruAlgo = def(
  "page-replacement-lru",
  "lru replacement",
  ["check PTE", "walk dir then table", "evict least-recent"],
  "lru",
);

export const clockAlgo = def(
  "page-replacement-clock",
  "clock replacement",
  ["check PTE", "walk dir then table", "if R=1: R=0; else evict"],
  "clock",
);
