import { buildAlgoSteps } from "@/engine/algo/build";
import { PAGING_COUNTERS as C } from "@/engine/algo/paging";
import type { AlgoDef } from "@/engine/algo/types";
import type { PagingState } from "@/engine/algo/views/paging";
import { pageFaultsAlgo } from "@/lessons/virtual-memory/page-faults";
import { describe, expect, it } from "vitest";

/**
 * The page-faults lesson states numbers. A failure here means the page now
 * lies, and the message should name the sentence that became untrue.
 */

function run<I>(def: AlgoDef<PagingState, I>, size: number) {
  const steps = buildAlgoSteps(def, size, 42);
  const last = steps[steps.length - 1]!;
  return { steps, state: last.state, counters: last.counters };
}

describe("page-faults: first touch pays disk, a repeat does not", () => {
  it("the default of two unique pages is the [0, 1, 0] trace", () => {
    // "Leave unique pages at 2. The trace is VPN 0, 1, 0."
    expect(pageFaultsAlgo.size).toMatchObject({ min: 1, max: 4, default: 2 });
    const { steps, counters } = run(pageFaultsAlgo, 2);
    expect(steps[0]!.note).toBe("Demand paging, 4 frames, no eviction.");
    expect(steps.map((s) => s.state.last?.vpn).filter((v) => v !== undefined)).toEqual([
      0, 0, 1, 1, 0,
    ]);
    // "Faults stop at 2, disk reads at 2, table refs at 6."
    expect(counters[C.faults]).toBe(2);
    expect(counters[C.diskReads]).toBe(2);
    expect(counters[C.walks]).toBe(6);
    expect(counters[C.evictions] ?? 0).toBe(0);
  });

  it("the third access is a walk of VPN 0, not a fault", () => {
    // "The third access is a walk of a present PTE — not a fault."
    const { steps, state } = run(pageFaultsAlgo, 2);
    const last = steps[steps.length - 1]!;
    expect(last.state.last).toEqual({ kind: "walk", vpn: 0 });
    expect(last.counters[C.faults]).toBe(2);
    expect(state.frames.map((f) => f.vpn)).toEqual([0, 1, null, null]);
    const pte0 = last.state.table.find((t) => t.label === "0");
    expect(pte0?.present).toBe(true);
    expect(pte0?.pfn).toBe(0);
  });

  it("first-touches load free frames 0 then 1", () => {
    // "walk 0 (dashed PTE), fault into free frame 0; walk 1, fault into free frame 1"
    const { steps } = run(pageFaultsAlgo, 2);
    const faults = steps.filter((s) => s.state.last?.kind === "fault");
    expect(faults).toHaveLength(2);
    expect(faults[0]!.note).toBe("Page fault VPN 0: loaded into free frame 0.");
    expect(faults[1]!.note).toBe("Page fault VPN 1: loaded into free frame 1.");
  });

  it("four unique pages fill every frame and still do not evict", () => {
    // "Drag to 4. Four first-touches fill every frame: 4 faults, 4 disk reads,
    // 10 table refs, still zero evictions."
    const { counters, state } = run(pageFaultsAlgo, 4);
    expect(counters[C.faults]).toBe(4);
    expect(counters[C.diskReads]).toBe(4);
    expect(counters[C.walks]).toBe(10);
    expect(counters[C.evictions] ?? 0).toBe(0);
    expect(state.frames.map((f) => f.vpn)).toEqual([0, 1, 2, 3]);
  });

  it("page faults equal disk reads at every slider position", () => {
    // "At every slider position — 1, 2, 3, and 4 — page faults equal disk reads."
    for (const n of [1, 2, 3, 4]) {
      const { counters } = run(pageFaultsAlgo, n);
      expect(counters[C.faults]).toBe(n);
      expect(counters[C.diskReads]).toBe(n);
      expect(counters[C.faults]).toBe(counters[C.diskReads]);
      expect(counters[C.evictions] ?? 0).toBe(0);
      expect(counters[C.walks]).toBe(2 * (n + 1));
    }
  });

  it("the opening frame is empty RAM and 0 faults", () => {
    // "At the opening frame the frames are empty, the directory chips are hollow"
    const { steps } = run(pageFaultsAlgo, 2);
    const start = steps[0]!;
    expect(start.counters[C.faults] ?? 0).toBe(0);
    expect(start.counters[C.diskReads] ?? 0).toBe(0);
    expect(start.state.frames.every((f) => f.vpn === null)).toBe(true);
    expect(start.state.directory.every((d) => !d.present)).toBe(true);
    expect(start.state.table).toEqual([]);
    expect(start.state.stamp).toBe("0 faults");
  });
});
