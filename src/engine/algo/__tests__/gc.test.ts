import { buildAlgoSteps } from "@/engine/algo/build";
import {
  GC_COUNTERS as C,
  runGenerational,
  runIncremental,
  runMarkSweep,
  runRefcount,
} from "@/engine/algo/gc";
import type { AlgoDef } from "@/engine/algo/types";
import type { GcState } from "@/engine/algo/views/gc";
import { GcView } from "@/engine/algo/views/GcView";
import type { ComponentType } from "react";
import { describe, expect, it } from "vitest";

describe("runRefcount", () => {
  it("acyclic A→B then drop both frees both", () => {
    const last = runRefcount(false).at(-1)!;
    expect(last.counters[C.freed]).toBe(2);
    expect(last.counters[C.leaked] ?? 0).toBe(0);
  });

  it("A↔B then drop both leaks both", () => {
    const last = runRefcount(true).at(-1)!;
    expect(last.counters[C.freed] ?? 0).toBe(0);
    expect(last.counters[C.leaked]).toBe(2);
  });
});

describe("runMarkSweep", () => {
  it("root 0→1 sweeps 2 and 3; an unrooted cycle is still swept", () => {
    expect(runMarkSweep(0).at(-1)!.counters[C.marked]).toBe(2);
    expect(runMarkSweep(0).at(-1)!.counters[C.swept]).toBe(2);
    expect(runMarkSweep(1).at(-1)!.counters[C.marked]).toBe(2);
    expect(runMarkSweep(1).at(-1)!.counters[C.swept]).toBe(2);
    expect(runMarkSweep(2).at(-1)!.counters[C.marked]).toBe(4);
    expect(runMarkSweep(2).at(-1)!.counters[C.swept] ?? 0).toBe(0);
  });
});

describe("runIncremental", () => {
  it("STW is one pause of 4; budget 1 is four slices of 1", () => {
    const stw = runIncremental(true, 1).at(-1)!;
    expect(stw.counters[C.pause]).toBe(4);
    expect(stw.counters[C.slices]).toBe(1);
    const inc = runIncremental(false, 1).at(-1)!;
    expect(inc.counters[C.pause]).toBe(1);
    expect(inc.counters[C.slices]).toBe(4);
    const fat = runIncremental(false, 4).at(-1)!;
    expect(fat.counters[C.pause]).toBe(4);
    expect(fat.counters[C.slices]).toBe(1);
  });
});

describe("runGenerational", () => {
  it("old→young without a barrier loses Y1; with one it holds", () => {
    const lost = runGenerational(false, true).at(-1)!;
    expect(lost.counters[C.lost]).toBe(1);
    expect(lost.counters[C.swept]).toBe(1);
    const held = runGenerational(true, true).at(-1)!;
    expect(held.counters[C.lost] ?? 0).toBe(0);
    expect(held.counters[C.cards]).toBe(1);
    expect(held.counters[C.swept] ?? 0).toBe(0);
    const garbage = runGenerational(false, false).at(-1)!;
    expect(garbage.counters[C.lost] ?? 0).toBe(0);
    expect(garbage.counters[C.swept]).toBe(1);
  });
});

describe("gc rides on archetype B", () => {
  const def: AlgoDef<GcState, boolean> = {
    id: "rc",
    title: "refcount",
    code: ["alloc", "link", "free", "drop"],
    counters: [{ key: C.freed, label: "freed" }],
    generateInput: () => false,
    run: (cyclic) => runRefcount(cyclic),
  };

  it("the view contract holds", () => {
    expect(buildAlgoSteps(def, 0, 1).length).toBeGreaterThan(1);
    const view: ComponentType<{ state: GcState }> = GcView;
    expect(view).toBe(GcView);
  });
});
