import { buildAlgoSteps } from "@/engine/algo/build";
import { DIRECT, INODE_COUNTERS as C, runInode } from "@/engine/algo/inode";
import type { AlgoDef } from "@/engine/algo/types";
import type { InodeState } from "@/engine/algo/views/inode";
import { inodeAlgo, inodeDirectAlgo } from "@/lessons/storage-io/inode";
import { describe, expect, it } from "vitest";

/**
 * The inode lesson states numbers. A failure here means the page now lies,
 * and the message should name the sentence that became untrue.
 */

function run<I>(def: AlgoDef<InodeState, I>, size: number, seed = 42) {
  const steps = buildAlgoSteps(def, size, seed);
  const last = steps[steps.length - 1]!;
  return {
    steps,
    state: last.state,
    counters: last.counters,
    inodeReads: last.counters[C.inodeReads] ?? 0,
    pointerReads: last.counters[C.pointerReads] ?? 0,
    dataReads: last.counters[C.dataReads] ?? 0,
  };
}

describe("inode: the slider is file blocks, 1 through 8", () => {
  it("offers 1 through 8, default 5 on the indirect figure and 4 on the direct one", () => {
    expect(inodeAlgo.size).toMatchObject({
      min: 1,
      max: 8,
      default: 5,
      label: "file blocks",
    });
    expect(inodeDirectAlgo.size).toMatchObject({ min: 1, max: 8, default: 4 });
    expect(DIRECT).toBe(4);
  });

  it("both figures are the same run at a given size", () => {
    for (const n of [1, 4, 5, 8]) {
      expect(buildAlgoSteps(inodeDirectAlgo, n, 42)).toEqual(
        buildAlgoSteps(inodeAlgo, n, 42),
      );
    }
  });

  it("ignores the seed: a file map is not a scheduler", () => {
    expect(buildAlgoSteps(inodeAlgo, 5, 1)).toEqual(
      buildAlgoSteps(inodeAlgo, 5, 99),
    );
  });
});

describe("inode: four blocks fit in the direct pointers", () => {
  it("a 4-block file is 4 inode reads, 4 data reads, 0 pointer reads", () => {
    // "Meters stop at 4 inode reads, 4 data reads, 0 pointer reads."
    const c = run(inodeDirectAlgo, 4);
    expect(c.inodeReads).toBe(4);
    expect(c.dataReads).toBe(4);
    expect(c.pointerReads).toBe(0);
  });

  it("the producer agrees, and the last block is still direct", () => {
    const last = runInode({ size: 4 }).at(-1)!;
    expect(last.counters[C.inodeReads]).toBe(4);
    expect(last.counters[C.dataReads]).toBe(4);
    expect(last.counters[C.pointerReads] ?? 0).toBe(0);
    expect(last.state.last).toEqual({ block: 3, via: "direct" });
    expect(last.state.stamp).toBe("4 blocks · direct 4");
  });

  it("opens with four named directs, hollow indirects, and no reads yet", () => {
    // "The stamp says 4 blocks · direct 4. The four direct chips already
    // name 0 through 3; the four indirect chips are hollow."
    const { steps } = run(inodeDirectAlgo, 4);
    const first = steps[0]!;
    expect(first.counters[C.inodeReads] ?? 0).toBe(0);
    expect(first.counters[C.dataReads] ?? 0).toBe(0);
    expect(first.counters[C.pointerReads] ?? 0).toBe(0);
    expect(first.state.last).toBeUndefined();
    expect(first.state.stamp).toBe("4 blocks · direct 4");
    expect(first.note).toBe("A 4-block file fits in the 4 direct pointers.");
    expect(first.state.directs.map((p) => p.block)).toEqual([0, 1, 2, 3]);
    expect(first.state.indirect.every((p) => p.block === null)).toBe(true);
  });

  it("steps d0 then d1, d2, d3, and never lights an indirect slot", () => {
    // "Step. Block 0 lights d0 and b0. Then d1, d2, d3."
    const notes = run(inodeDirectAlgo, 4).steps.map((s) => s.note);
    expect(notes).toContain("Read block 0 via direct pointer d0.");
    expect(notes).toContain("Read block 1 via direct pointer d1.");
    expect(notes).toContain("Read block 2 via direct pointer d2.");
    expect(notes).toContain("Read block 3 via direct pointer d3.");
    const last = run(inodeDirectAlgo, 4).state;
    expect(last.directs.filter((p) => p.active).map((p) => p.label)).toEqual([
      "d3",
    ]);
    expect(last.indirect.every((p) => !p.active)).toBe(true);
  });

  it("sizes 1 through 4 never pay a pointer read", () => {
    // "Drag to 1, 2, or 3. Pointer reads stay 0. inode reads and data
    // reads equal the file size."
    for (const n of [1, 2, 3, 4]) {
      const c = run(inodeDirectAlgo, n);
      expect(c.pointerReads).toBe(0);
      expect(c.inodeReads).toBe(n);
      expect(c.dataReads).toBe(n);
      expect(c.state.last?.via).toBe("direct");
    }
  });
});

describe("inode: the fifth block costs one extra pointer read", () => {
  it("a 5-block file is 5 inode reads, 5 data reads, 1 pointer read", () => {
    // "Meters: 5 inode reads, 5 data reads, 1 pointer read."
    const c = run(inodeAlgo, 5);
    expect(c.inodeReads).toBe(5);
    expect(c.dataReads).toBe(5);
    expect(c.pointerReads).toBe(1);
    expect(c.state.last).toEqual({ block: 4, via: "indirect" });
    expect(c.state.stamp).toBe("1 pointer read");
  });

  it("opens needing the indirect block for block 4, with i0 already named", () => {
    // "Leave file blocks at 5. Slot i0 already names 4; i1–i3 stay hollow."
    const first = run(inodeAlgo, 5).steps[0]!;
    expect(first.note).toBe(
      "A 5-block file needs the indirect block for blocks 4–4.",
    );
    expect(first.state.stamp).toBe("5 blocks · direct 4");
    expect(first.state.indirect.map((p) => p.block)).toEqual([
      4,
      null,
      null,
      null,
    ]);
    expect(first.counters[C.pointerReads] ?? 0).toBe(0);
  });

  it("the first four blocks are still direct; the fifth lights i0", () => {
    // "Step the first four blocks. After d3 the meters still read 4, 4, and 0."
    // "One more step. Block 4 lights i0 and b4. The stamp flips to 1 pointer read."
    const { steps } = run(inodeAlgo, 5);
    const afterDirect = steps[4]!;
    expect(afterDirect.state.last).toEqual({ block: 3, via: "direct" });
    expect(afterDirect.counters[C.inodeReads]).toBe(4);
    expect(afterDirect.counters[C.dataReads]).toBe(4);
    expect(afterDirect.counters[C.pointerReads] ?? 0).toBe(0);
    expect(afterDirect.state.stamp).toBe("5 blocks · direct 4");

    const fifth = steps[5]!;
    expect(fifth.note).toBe(
      "Read block 4 via indirect slot i0 — one extra pointer read.",
    );
    expect(fifth.counters[C.pointerReads]).toBe(1);
    expect(fifth.state.stamp).toBe("1 pointer read");
    expect(fifth.state.indirect.filter((p) => p.active).map((p) => p.label)).toEqual(
      ["i0"],
    );
    expect(fifth.state.data[4]!.active).toBe(true);
  });
});

describe("inode: eight blocks cost four pointer reads", () => {
  it("an 8-block file is 8 inode reads, 8 data reads, 4 pointer reads", () => {
    // "Drag to 8. Four pointer reads, eight data reads, eight inode reads."
    const c = run(inodeAlgo, 8);
    expect(c.inodeReads).toBe(8);
    expect(c.dataReads).toBe(8);
    expect(c.pointerReads).toBe(4);
    expect(c.state.last).toEqual({ block: 7, via: "indirect" });
    expect(c.state.stamp).toBe("4 pointer reads");
    expect(c.state.indirect.map((p) => p.block)).toEqual([4, 5, 6, 7]);
  });

  it("each block past the direct range adds one pointer read", () => {
    // "Each block past d3 paid the extra lookup."
    // "The pointer-reads meter: 0 at 4, 1 at 5, 4 at 8."
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const c = run(inodeAlgo, n);
      expect(c.inodeReads).toBe(n);
      expect(c.dataReads).toBe(n);
      expect(c.pointerReads).toBe(Math.max(0, n - DIRECT));
    }
  });

  it("the last caption at 8 is block 7 via i3", () => {
    const last = run(inodeAlgo, 8).steps.at(-1)!;
    expect(last.note).toBe(
      "Read block 7 via indirect slot i3 — one extra pointer read.",
    );
  });
});
