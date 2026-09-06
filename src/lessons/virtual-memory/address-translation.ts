import {
  PAGING_COUNTERS,
  runPaging,
  type PagingConfig,
} from "@/engine/algo/paging";
import type { AlgoDef } from "@/engine/algo/types";
import type { PagingState } from "@/engine/algo/views/paging";

/**
 * Address Translation — archetype B (`engine: "steps"`).
 *
 * A virtual page number is four bits (0–15) and splits into a 2-bit directory
 * index (vpn >> 2) and a 2-bit table index (vpn & 3). A translation that
 * misses the TLB walks both. This lesson is the walk: identity-mapped, no
 * TLB, sixteen frames, so every VPN is present and nothing faults. The
 * number the figure is for is that three translations cost six table
 * references — two per page, whether those pages share a table or not.
 *
 * THE CONTROL IS HOW MANY TRANSLATIONS RUN. 1 / 3 / 4 / 8 are the
 * interesting stops: one walk (2 refs), the measured default (6), every
 * directory slot (8), and a second pass at table-index 1 (16). Every
 * position adds two refs.
 *
 * Two defs, same slider, same counters. The first strides by four so each
 * step lights a new directory slot (0, 4, 8, 12, then 1, 5, 9, 13). The
 * second stays inside table 0 (0, 1, 2, 3, then repeats). At three
 * translations both meters read 6. Two-level page tables do not discount
 * the walk; they keep the directory small.
 *
 * MODELLING NOTE, and its limits. The producer records a walk as one frame
 * and bumps `walks` by two, so directory-then-table is a caption and a
 * meter, not two steps. The identity map marks every PTE present on the
 * first frame, so the sparse-table saving is an argument, not a picture.
 * Offset bits are absent: the stage translates VPNs, not bytes. A TLB of
 * size 0 is how this lesson refuses to steal the next one.
 */

const ACROSS = [0, 4, 8, 12, 1, 5, 9, 13];
const SAME = [0, 1, 2, 3, 0, 1, 2, 3];

const CODE = [
  "hi = vpn >> 2",
  "walk dir then table",
  "use pte.pfn",
];

const counters = [
  { key: PAGING_COUNTERS.walks, label: "table refs" },
  { key: PAGING_COUNTERS.faults, label: "faults" },
];

const sizeControl = {
  label: "translations",
  min: 1,
  max: 8,
  default: 3,
};

function identity(accesses: number[]): PagingConfig {
  return {
    tlbSize: 0,
    frames: 16,
    replacement: "none",
    demand: false,
    accesses,
  };
}

function def(
  id: string,
  title: string,
  pattern: number[],
): AlgoDef<PagingState, PagingConfig> {
  return {
    id,
    title,
    code: CODE,
    counters,
    size: sizeControl,
    generateInput: (_rng, size) => identity(pattern.slice(0, size)),
    run: (input) => runPaging(input),
  };
}

/** One VPN from each directory, then the same four at table-index 1. */
export const addressTranslationAlgo = def(
  "address-translation",
  "across directories",
  ACROSS,
);

/** Four consecutive VPNs in directory 0, then the same four again. */
export const addressTranslationSameTableAlgo = def(
  "address-translation-same-table",
  "one table",
  SAME,
);
