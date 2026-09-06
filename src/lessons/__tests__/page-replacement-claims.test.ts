import { buildAlgoSteps } from "@/engine/algo/build";
import { PAGING_COUNTERS as C } from "@/engine/algo/paging";
import type { AlgoDef } from "@/engine/algo/types";
import type { PagingState } from "@/engine/algo/views/paging";
import {
  clockAlgo,
  fifoAlgo,
  lruAlgo,
} from "@/lessons/virtual-memory/page-replacement";
import { describe, expect, it } from "vitest";

/**
 * The page-replacement lesson states numbers. A failure here means the page
 * now lies, and the message should name the sentence that became untrue.
 */

function lastOf<I>(def: AlgoDef<PagingState, I>, frames: number) {
  const steps = buildAlgoSteps(def, frames, 42);
  const last = steps[steps.length - 1]!;
  return {
    steps,
    state: last.state,
    mapped: last.state.frames.map((f) => f.vpn),
    faults: last.counters[C.faults] ?? 0,
    evictions: last.counters[C.evictions] ?? 0,
  };
}

/** VPNs thrown out, in order, by comparing the victim frame to the prior step. */
function victims<I>(def: AlgoDef<PagingState, I>, frames: number): number[] {
  const steps = buildAlgoSteps(def, frames, 42);
  const out: number[] = [];
  for (let i = 1; i < steps.length; i++) {
    if (steps[i]!.state.last?.kind !== "evict") continue;
    const pfn = steps[i]!.state.frames.findIndex((f) => f.victim);
    const vpn = steps[i - 1]!.state.frames[pfn]?.vpn;
    if (vpn !== null && vpn !== undefined) out.push(vpn);
  }
  return out;
}

describe("page-replacement: three frames, accesses 0,1,2,0,3", () => {
  it("FIFO evicts VPN 0 to install 3, even though 0 was just used", () => {
    // "frame 0 goes red, and VPN 0 is gone even though you just used it."
    // "The frames that remain are 3, 1, 2."
    // "Meters land on 4 page faults and 1 eviction."
    const r = lastOf(fifoAlgo, 3);
    expect(victims(fifoAlgo, 3)).toEqual([0]);
    expect(r.mapped).toEqual([3, 1, 2]);
    expect(r.mapped).not.toContain(0);
    expect(r.faults).toBe(4);
    expect(r.evictions).toBe(1);
  });

  it("LRU keeps VPN 0 and evicts 1 instead", () => {
    // "The red victim is frame 1: VPN 1 leaves, VPN 0 stays."
    // "The frames that remain are 0, 3, 2."
    const r = lastOf(lruAlgo, 3);
    expect(victims(lruAlgo, 3)).toEqual([1]);
    expect(r.mapped).toEqual([0, 3, 2]);
    expect(r.mapped).toContain(0);
    expect(r.mapped).toContain(3);
    expect(r.mapped).not.toContain(1);
    expect(r.faults).toBe(4);
    expect(r.evictions).toBe(1);
  });

  it("CLOCK matches FIFO on this pattern: still evicts VPN 0", () => {
    // "The red victim is frame 0: VPN 0 leaves, just as under FIFO."
    // "Frames that remain: 3, 1, 2."
    // "Meters match FIFO exactly: 4 faults, 1 eviction."
    const clock = lastOf(clockAlgo, 3);
    const fifo = lastOf(fifoAlgo, 3);
    expect(victims(clockAlgo, 3)).toEqual([0]);
    expect(clock.mapped).toEqual([3, 1, 2]);
    expect(clock.mapped).toEqual(fifo.mapped);
    expect(clock.faults).toBe(4);
    expect(clock.evictions).toBe(1);
    expect(clock.faults).toBe(fifo.faults);
    expect(clock.evictions).toBe(fifo.evictions);
  });
});

describe("page-replacement: the slider is pressure, not a size", () => {
  it("four frames fit the working set: 4 faults, 0 evictions, pages 0,1,2,3", () => {
    // "The working set fits: 4 faults, 0 evictions, frames 0, 1, 2, 3 under both policies."
    for (const def of [fifoAlgo, lruAlgo, clockAlgo]) {
      const r = lastOf(def, 4);
      expect(r.faults).toBe(4);
      expect(r.evictions).toBe(0);
      expect(r.mapped).toEqual([0, 1, 2, 3]);
      expect(victims(def, 4)).toEqual([]);
    }
  });

  it("two frames: five faults, three evictions, both policies end at 3, 0", () => {
    // "Five accesses, five faults, three evictions. Both policies end at frames 3, 0"
    // "the re-access of 0 is now a fault"
    for (const def of [fifoAlgo, lruAlgo, clockAlgo]) {
      const r = lastOf(def, 2);
      expect(r.faults).toBe(5);
      expect(r.evictions).toBe(3);
      expect(r.mapped).toEqual([3, 0]);
    }
    expect(victims(fifoAlgo, 2)).toEqual([0, 1, 2]);
    expect(victims(lruAlgo, 2)).toEqual([0, 1, 2]);
    expect(victims(clockAlgo, 2)).toEqual([0, 1, 2]);
  });

  it("CLOCK still matches FIFO at two frames and at four", () => {
    // "CLOCK still matches FIFO on this pattern: no eviction at four frames,
    // three evictions ending at 3, 0 at two."
    expect(lastOf(clockAlgo, 2).mapped).toEqual(lastOf(fifoAlgo, 2).mapped);
    expect(lastOf(clockAlgo, 4).mapped).toEqual(lastOf(fifoAlgo, 4).mapped);
    expect(lastOf(clockAlgo, 2).evictions).toBe(3);
    expect(lastOf(clockAlgo, 4).evictions).toBe(0);
  });

  it("offers frames 2 through 4, default 3", () => {
    for (const def of [fifoAlgo, lruAlgo, clockAlgo]) {
      expect(def.size).toMatchObject({ min: 2, max: 4, default: 3 });
    }
  });
});
