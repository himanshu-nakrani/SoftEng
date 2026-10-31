import { buildAlgoSteps } from "@/engine/algo/build";
import {
  STORAGE_COUNTERS,
  runStorage,
  type StorageScript,
} from "@/engine/algo/storage";
import type { AlgoDef } from "@/engine/algo/types";
import type { StorageState } from "@/engine/algo/views/storage";
import { StorageView } from "@/engine/algo/views/StorageView";
import type { ComponentType } from "react";
import { describe, expect, it } from "vitest";

const C = STORAGE_COUNTERS;

const KEYS = "abcdefghijkl".split("");

function script(engine: StorageScript["engine"], writes: number): StorageScript {
  const ops: StorageScript["ops"] = [
    ...KEYS.slice(0, writes).map((key) => ({ kind: "write" as const, key })),
    { kind: "read", key: KEYS[0]! },
    { kind: "read", key: KEYS[Math.floor((writes - 1) / 2)]! },
    { kind: "read", key: KEYS[writes - 1]! },
    { kind: "read", key: "z" },
  ];
  return { engine, ops };
}

const last = (steps: { state: StorageState; counters: Record<string, number> }[]) =>
  steps[steps.length - 1];

describe("runStorage", () => {
  it("is deterministic and starts from the untouched input", () => {
    const a = runStorage(script("btree", 8));
    expect(a).toEqual(runStorage(script("btree", 8)));

    const first = a[0]!.state;
    expect(first.lastOp).toBeUndefined();
    expect(first.found).toBeUndefined();
    expect(a[0]!.counters[C.pageWrites] ?? 0).toBe(0);
    expect(a[0]!.counters[C.pageReads] ?? 0).toBe(0);
  });

  it("never aliases a frame, so stepping back shows pages as they were", () => {
    const steps = runStorage(script("lsm", 8));
    expect(new Set(steps.map((s) => s.state)).size).toBe(steps.length);
    expect(new Set(steps.map((s) => s.state.pages)).size).toBe(steps.length);
  });

  it("keeps counters monotonic and produces more than one frame", () => {
    for (const engine of ["btree", "lsm"] as const) {
      const steps = runStorage(script(engine, 8));
      expect(steps.length).toBeGreaterThan(1);
      const totals: Record<string, number> = {};
      for (const step of steps) {
        for (const [key, value] of Object.entries(step.counters)) {
          expect(value).toBeGreaterThanOrEqual(totals[key] ?? 0);
          totals[key] = value;
        }
      }
    }
  });
});

describe("B-tree rewrites a whole leaf per write", () => {
  it("pays one page write and two page reads for every logical write", () => {
    const { counters } = last(runStorage(script("btree", 8)));
    // Height 2: root then leaf, every time. Eight writes, then four reads.
    expect(counters[C.pageWrites]).toBe(8);
    expect(counters[C.pageReads]).toBe(8 * 2 + 4 * 2);
    expect(counters[C.compactions] ?? 0).toBe(0);
    expect(counters[C.bloomMisses] ?? 0).toBe(0);
  });

  it("still walks the tree for a missing key", () => {
    const steps = runStorage(script("btree", 4));
    const missing = steps.filter((s) => s.state.lastOp?.kind === "read" && s.state.lastOp.key === "z");
    expect(missing).toHaveLength(1);
    expect(missing[0]!.state.found).toBe(false);
  });
});

describe("LSM appends cheaply and pays at flush and compaction", () => {
  it("does not write a page until the memtable fills", () => {
    const steps = runStorage(script("lsm", 3));
    const writes = steps.filter((s) => s.state.lastOp?.kind === "write");
    expect(writes).toHaveLength(3);
    expect(last(writes).counters[C.pageWrites] ?? 0).toBe(0);
  });

  it("flushes every four writes and does not compact at two SSTables", () => {
    const { counters, state } = last(runStorage(script("lsm", 8)));
    expect(counters[C.pageWrites]).toBe(2);
    expect(counters[C.compactions] ?? 0).toBe(0);
    expect(state.pages.filter((p) => p.kind === "sstable")).toHaveLength(2);
  });

  it("compacts three SSTables into one at twelve writes", () => {
    const { counters, state } = last(runStorage(script("lsm", 12)));
    expect(counters[C.compactions]).toBe(1);
    expect(state.pages.filter((p) => p.kind === "sstable")).toHaveLength(1);
    // Three flushes plus one compacted output. Compaction also reads the three
    // runs it merges.
    expect(counters[C.pageWrites]).toBe(4);
    expect(counters[C.pageReads]).toBeGreaterThanOrEqual(3);
  });

  it("skips SSTables whose bloom says no, and does not read for an absent key", () => {
    const steps = runStorage(script("lsm", 8));
    const missing = steps.find((s) => s.state.lastOp?.kind === "read" && s.state.lastOp.key === "z")!;
    expect(missing.state.found).toBe(false);
    expect(missing.state.pages.filter((p) => p.kind === "sstable" && p.bloomSkip).length).toBe(2);
    // Two bloom misses, zero page reads on this frame relative to the previous.
    const prev = steps[steps.indexOf(missing) - 1]!;
    expect(missing.counters[C.pageReads]).toBe(prev.counters[C.pageReads] ?? 0);
    expect(missing.counters[C.bloomMisses] - (prev.counters[C.bloomMisses] ?? 0)).toBe(2);
  });
});

describe("storage rides on archetype B", () => {
  const def: AlgoDef<StorageState, StorageScript> = {
    id: "storage-lsm",
    title: "lsm",
    code: [
      "append to memtable",
      "flush if memtable full",
      "compact if too many",
      "read: bloom each run",
    ],
    counters: [
      { key: C.pageReads, label: "page reads" },
      { key: C.pageWrites, label: "page writes" },
      { key: C.compactions, label: "compactions" },
      { key: C.bloomMisses, label: "bloom misses" },
    ],
    size: { label: "keys written", min: 4, max: 12, default: 8 },
    generateInput: (_rng, size) => script("lsm", size),
    run: (input) => runStorage(input),
  };

  it("runs through buildAlgoSteps, and size changes the run", () => {
    expect(buildAlgoSteps(def, 8, 42)).toEqual(buildAlgoSteps(def, 8, 42));
    expect(buildAlgoSteps(def, 8, 42)).not.toEqual(buildAlgoSteps(def, 12, 42));
  });

  it("ignores the seed, because a storage engine is not a scheduler", () => {
    expect(buildAlgoSteps(def, 8, 1)).toEqual(buildAlgoSteps(def, 8, 999));
  });

  it("satisfies the view contract the figure requires", () => {
    const view: ComponentType<{ state: StorageState }> = StorageView;
    expect(view).toBe(StorageView);
  });
});
