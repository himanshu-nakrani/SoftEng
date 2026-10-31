import { buildAlgoSteps } from "@/engine/algo/build";
import { PAGING_COUNTERS as C, runPaging } from "@/engine/algo/paging";
import type { AlgoDef } from "@/engine/algo/types";
import type { PagingState } from "@/engine/algo/views/paging";
import { tlbAlgo, tlbNoneAlgo } from "@/lessons/virtual-memory/tlb";
import { describe, expect, it } from "vitest";

/**
 * The TLB lesson states numbers. A failure here means the page now lies,
 * and the message should name the sentence that became untrue.
 */

function run<I>(def: AlgoDef<PagingState, I>, size: number) {
  const steps = buildAlgoSteps(def, size, 42);
  const last = steps[steps.length - 1]!;
  return { steps, counters: last.counters, state: last.state };
}

const SIZES = [3, 4, 5, 6, 7, 8] as const;

describe("tlb: the slider is reuse of one page, 3 through 8", () => {
  it("offers 3 through 8 on both figures", () => {
    // "Both figures repeat VPN 0; the slider is how many times."
    for (const def of [tlbNoneAlgo, tlbAlgo]) {
      expect(def.size).toMatchObject({ min: 3, max: 8, default: 8 });
    }
  });

  it("never faults: this lesson is the hit, not the missing page", () => {
    for (const n of SIZES) {
      expect(run(tlbNoneAlgo, n).counters[C.faults] ?? 0).toBe(0);
      expect(run(tlbAlgo, n).counters[C.faults] ?? 0).toBe(0);
    }
  });
});

describe("tlb: 'without a TLB' claims", () => {
  it("three translations of the same page cost 6 table refs", () => {
    // "Three translations of the same page cost 6 table refs."
    const { counters } = run(tlbNoneAlgo, 3);
    expect(counters[C.walks]).toBe(6);
    expect(counters[C.tlbHits] ?? 0).toBe(0);
    expect(counters[C.tlbMisses] ?? 0).toBe(0);
  });

  it("eight cost 16 table refs, with nothing to hit or miss", () => {
    // "Eight cost 16." / "Table refs land on 16. Hits and misses stay at 0 —
    // there is no cache, so there is nothing to hit."
    const { counters, state } = run(tlbNoneAlgo, 8);
    expect(counters[C.walks]).toBe(16);
    expect(counters[C.tlbHits] ?? 0).toBe(0);
    expect(counters[C.tlbMisses] ?? 0).toBe(0);
    expect(state.tlbEnabled).toBe(false);
  });

  it("every extra access is two more table refs, 3 through 8", () => {
    for (const n of SIZES) {
      expect(run(tlbNoneAlgo, n).counters[C.walks]).toBe(2 * n);
    }
  });
});

describe("tlb: 'a hit skips the walk' claims", () => {
  it("three repeats of VPN 0: 1 miss, 2 hits, 2 table refs", () => {
    // "With one: 1 miss, 2 hits, still 2 table refs."
    // Known measurement: tlbSize 4, accesses [0,0,0].
    const { counters } = run(tlbAlgo, 3);
    expect(counters[C.tlbMisses]).toBe(1);
    expect(counters[C.tlbHits]).toBe(2);
    expect(counters[C.walks]).toBe(2);
  });

  it("eight repeats: 1 miss, 7 hits, still 2 table refs", () => {
    // "Skip to the end: 7 hits, 1 miss, table refs still 2."
    const { counters, state } = run(tlbAlgo, 8);
    expect(counters[C.tlbMisses]).toBe(1);
    expect(counters[C.tlbHits]).toBe(7);
    expect(counters[C.walks]).toBe(2);
    expect(state.tlbEnabled).toBe(true);
  });

  it("every extra access is one more hit; walks stay at 2", () => {
    for (const n of SIZES) {
      const { counters } = run(tlbAlgo, n);
      expect(counters[C.tlbMisses]).toBe(1);
      expect(counters[C.tlbHits]).toBe(n - 1);
      expect(counters[C.walks]).toBe(2);
    }
  });

  it("a hit leaves the table empty — the walk is skipped, not cheaper", () => {
    // "The table row says walk skipped." / "A hit is not a cheaper walk. It is no walk."
    const { steps } = run(tlbAlgo, 8);
    const hits = steps.filter((s) => s.state.last?.kind === "tlb-hit");
    const walks = steps.filter((s) => s.state.last?.kind === "walk");
    expect(hits).toHaveLength(7);
    expect(walks).toHaveLength(1);
    for (const hit of hits) {
      expect(hit.state.table).toEqual([]);
    }
    expect(walks[0]!.state.table).toHaveLength(4);
  });
});

describe("tlb: a one-entry TLB cannot cache a two-page loop", () => {
  it("tlbSize 1 and accesses 0,1,0,1,0,1,0,1 still walk 16 times", () => {
    // "A one-entry TLB and a two-page loop of eight accesses still cost 16
    // table refs: FIFO evicts the other page on every miss, so the hit
    // counter never leaves 0."
    const steps = runPaging({
      tlbSize: 1,
      frames: 4,
      replacement: "none",
      demand: false,
      accesses: [0, 1, 0, 1, 0, 1, 0, 1],
    });
    const { counters } = steps[steps.length - 1]!;
    expect(counters[C.walks]).toBe(16);
    expect(counters[C.tlbHits] ?? 0).toBe(0);
    expect(counters[C.tlbMisses]).toBe(8);
  });
});
