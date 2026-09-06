import {
  PAGING_COUNTERS,
  runPaging,
  type PagingConfig,
} from "@/engine/algo/paging";
import type { AlgoDef } from "@/engine/algo/types";
import type { PagingState } from "@/engine/algo/views/paging";

/**
 * Page Faults and Demand Paging — archetype B (`engine: "steps"`).
 *
 * Address translation assumed the PTE was valid. Demand paging starts the other
 * way: every PTE is invalid, RAM holds nothing, and the first access of a
 * virtual page is a fault that allocates a free frame and reads the page from
 * disk. A later access of the same VPN finds the PTE present and does not
 * fault. That is the whole argument.
 *
 * THE CONTROL IS HOW MANY UNIQUE PAGES ARE TOUCHED. Each run first-touches
 * VPNs 0..n-1, then repeats VPN 0 so the second access is visible on every
 * setting. Default 2 is the measured trace [0, 1, 0]: two faults, two disk
 * reads, six table refs, zero evictions. At 4 the four frames are full and
 * evictions are still zero — this lesson is about first touch, not victims.
 *
 * MODELLING NOTE, and its limits. `replacement: "none"` with four frames, and
 * the slider stops at four unique pages, so a free frame always exists. The
 * producer will still pick a victim if you ask it to map a fifth page into
 * four frames; we do not. The TLB is off, so a repeat still walks. There is
 * no minor fault: `fault` always bumps `diskReads`. Shared mappings, a page
 * cache, copy-on-write, and anonymous zero-fill are absent — those are what
 * would split the two meters.
 */

const CODE = [
  "access a vpn",
  "walk the tables",
  "fault, read disk",
];

const counters = [
  { key: PAGING_COUNTERS.faults, label: "page faults" },
  { key: PAGING_COUNTERS.diskReads, label: "disk reads" },
  { key: PAGING_COUNTERS.walks, label: "table refs" },
  { key: PAGING_COUNTERS.evictions, label: "evictions" },
];

/** Four frames, no TLB, no replacement: first touch only. */
function demandRun(uniquePages: number): PagingConfig {
  return {
    tlbSize: 0,
    frames: 4,
    replacement: "none",
    demand: true,
    accesses: [...Array.from({ length: uniquePages }, (_, i) => i), 0],
  };
}

export const pageFaultsAlgo: AlgoDef<PagingState, PagingConfig> = {
  id: "page-faults",
  title: "demand paging",
  code: CODE,
  counters,
  size: {
    label: "unique pages",
    min: 1,
    max: 4,
    default: 2,
  },
  generateInput: (_rng, size) => demandRun(size),
  run: (input) => runPaging(input),
};
