import { buildAlgoSteps } from "@/engine/algo/build";
import { STORAGE_COUNTERS as C } from "@/engine/algo/storage";
import type { AlgoDef } from "@/engine/algo/types";
import type { StorageState } from "@/engine/algo/views/storage";
import { btreeAlgo, lsmAlgo } from "@/lessons/storage/btree-vs-lsm";
import { describe, expect, it } from "vitest";

/**
 * The B-tree vs LSM lesson states numbers. A failure here means the page now
 * lies, and the message should name the sentence that became untrue.
 */

function run<I>(def: AlgoDef<StorageState, I>, size: number) {
  const steps = buildAlgoSteps(def, size, 42);
  return steps[steps.length - 1]!.counters;
}

describe("btree-vs-lsm: eight keys, two engines", () => {
  it("the B-tree rewrites eight leaves and pays height two on every op", () => {
    // "At the end, page writes read 8 and page reads read 24"
    const c = run(btreeAlgo, 8);
    expect(c[C.pageWrites]).toBe(8);
    expect(c[C.pageReads]).toBe(24);
  });

  it("the LSM flushes twice, never compact, and bloom-skips the miss", () => {
    // "At eight keys the meters read 2 page writes, 3 page reads, 4 bloom
    // misses, and no compaction."
    const c = run(lsmAlgo, 8);
    expect(c[C.pageWrites]).toBe(2);
    expect(c[C.pageReads]).toBe(3);
    expect(c[C.bloomMisses]).toBe(4);
    expect(c[C.compactions] ?? 0).toBe(0);
  });

  it("twelve keys is the first LSM compaction, 4 writes and 6 reads", () => {
    // "Drag to 12. ... page writes become 4, page reads 6, one compaction."
    const c = run(lsmAlgo, 12);
    expect(c[C.pageWrites]).toBe(4);
    expect(c[C.pageReads]).toBe(6);
    expect(c[C.compactions]).toBe(1);
  });

  it("the same twelve keys still cost the B-tree one rewrite each", () => {
    // "the B-tree's twelve leaf rewrites" and "32" page reads at twelve.
    const c = run(btreeAlgo, 12);
    expect(c[C.pageWrites]).toBe(12);
    expect(c[C.pageReads]).toBe(32);
  });
});
