import { buildAlgoSteps } from "@/engine/algo/build";
import {
  PAGING_COUNTERS,
  runPaging,
  type PagingConfig,
} from "@/engine/algo/paging";
import type { AlgoDef } from "@/engine/algo/types";
import type { PagingState } from "@/engine/algo/views/paging";
import { PagingView } from "@/engine/algo/views/PagingView";
import type { ComponentType } from "react";
import { describe, expect, it } from "vitest";

const C = PAGING_COUNTERS;

function cfg(partial: Partial<PagingConfig> & Pick<PagingConfig, "accesses">): PagingConfig {
  return {
    tlbSize: 0,
    frames: 16,
    replacement: "none",
    demand: false,
    ...partial,
  };
}

const last = (steps: { state: PagingState; counters: Record<string, number> }[]) =>
  steps[steps.length - 1]!;

describe("runPaging", () => {
  it("is deterministic, starts untouched, and never aliases a frame", () => {
    const a = runPaging(cfg({ accesses: [0, 5, 10] }));
    expect(a).toEqual(runPaging(cfg({ accesses: [0, 5, 10] })));
    expect(a[0]!.counters[C.walks] ?? 0).toBe(0);
    expect(new Set(a.map((s) => s.state)).size).toBe(a.length);
    expect(new Set(a.map((s) => s.state.frames)).size).toBe(a.length);
  });

  it("a two-level walk costs two page-table references per translation", () => {
    const { counters } = last(runPaging(cfg({ accesses: [0, 4, 8] })));
    expect(counters[C.walks]).toBe(6);
    expect(counters[C.tlbHits] ?? 0).toBe(0);
    expect(counters[C.faults] ?? 0).toBe(0);
  });
});

describe("the TLB skips a walk on a hit", () => {
  it("repeats of the same VPN hit after the first miss", () => {
    const { counters } = last(
      runPaging(cfg({ tlbSize: 4, accesses: [0, 0, 0] })),
    );
    expect(counters[C.tlbMisses]).toBe(1);
    expect(counters[C.tlbHits]).toBe(2);
    expect(counters[C.walks]).toBe(2);
  });
});

describe("demand paging faults on first access", () => {
  it("loads into a free frame and does not fault the second time", () => {
    const { counters } = last(
      runPaging(cfg({ demand: true, frames: 4, accesses: [0, 1, 0] })),
    );
    expect(counters[C.faults]).toBe(2);
    expect(counters[C.diskReads]).toBe(2);
    expect(counters[C.evictions] ?? 0).toBe(0);
  });
});

describe("replacement: FIFO evicts the oldest, LRU the least recent", () => {
  const pattern = [0, 1, 2, 0, 3];

  it("FIFO evicts VPN 0 to make room for 3, even though 0 was just used", () => {
    const steps = runPaging(
      cfg({ demand: true, frames: 3, replacement: "fifo", accesses: pattern }),
    );
    const { counters, state } = last(steps);
    expect(counters[C.evictions]).toBe(1);
    const mapped = state.frames.map((f) => f.vpn);
    expect(mapped).toContain(3);
    expect(mapped).not.toContain(0);
  });

  it("LRU keeps VPN 0 and evicts 1 instead", () => {
    const { state, counters } = last(
      runPaging(
        cfg({ demand: true, frames: 3, replacement: "lru", accesses: pattern }),
      ),
    );
    expect(counters[C.evictions]).toBe(1);
    const mapped = state.frames.map((f) => f.vpn);
    expect(mapped).toContain(0);
    expect(mapped).toContain(3);
    expect(mapped).not.toContain(1);
  });
});

describe("paging rides on archetype B", () => {
  const def: AlgoDef<PagingState, PagingConfig> = {
    id: "paging",
    title: "translate",
    code: ["check TLB", "walk directory", "walk table", "fault if invalid"],
    counters: [
      { key: C.walks, label: "table refs" },
      { key: C.tlbHits, label: "tlb hits" },
      { key: C.faults, label: "faults" },
    ],
    size: { label: "accesses", min: 3, max: 8, default: 5 },
    generateInput: (_rng, size) =>
      cfg({ accesses: [0, 1, 2, 0, 3, 4, 5, 1].slice(0, size) }),
    run: (input) => runPaging(input),
  };

  it("runs through buildAlgoSteps and ignores the seed", () => {
    expect(buildAlgoSteps(def, 5, 1)).toEqual(buildAlgoSteps(def, 5, 99));
    expect(buildAlgoSteps(def, 3, 1)).not.toEqual(buildAlgoSteps(def, 5, 1));
  });

  it("satisfies the view contract the figure requires", () => {
    const view: ComponentType<{ state: PagingState }> = PagingView;
    expect(view).toBe(PagingView);
  });
});
