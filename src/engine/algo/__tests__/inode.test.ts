import { buildAlgoSteps } from "@/engine/algo/build";
import { DIRECT, INODE_COUNTERS, runInode } from "@/engine/algo/inode";
import type { AlgoDef } from "@/engine/algo/types";
import type { InodeState } from "@/engine/algo/views/inode";
import { InodeView } from "@/engine/algo/views/InodeView";
import type { ComponentType } from "react";
import { describe, expect, it } from "vitest";

const C = INODE_COUNTERS;
const last = (size: number) => runInode({ size }).at(-1)!;

describe("runInode", () => {
  it("is deterministic, starts with no reads, never aliases", () => {
    expect(runInode({ size: 5 })).toEqual(runInode({ size: 5 }));
    expect(runInode({ size: 5 })[0]!.counters[C.dataReads] ?? 0).toBe(0);
    const steps = runInode({ size: 6 });
    expect(new Set(steps.map((s) => s.state)).size).toBe(steps.length);
  });

  it("a file that fits in direct pointers does no pointer reads", () => {
    const { counters } = last(DIRECT);
    expect(counters[C.dataReads]).toBe(DIRECT);
    expect(counters[C.inodeReads]).toBe(DIRECT);
    expect(counters[C.pointerReads] ?? 0).toBe(0);
  });

  it("the first block past direct pays one pointer read", () => {
    expect(last(DIRECT + 1).counters[C.pointerReads]).toBe(1);
    expect(last(DIRECT + 2).counters[C.pointerReads]).toBe(2);
  });
});

describe("inode rides on archetype B", () => {
  const def: AlgoDef<InodeState, { size: number }> = {
    id: "inode",
    title: "inode",
    code: ["direct pointer", "indirect then data"],
    counters: [
      { key: C.inodeReads, label: "inode reads" },
      { key: C.pointerReads, label: "pointer reads" },
      { key: C.dataReads, label: "data reads" },
    ],
    size: { label: "file blocks", min: 1, max: 8, default: 5 },
    generateInput: (_rng, size) => ({ size }),
    run: (input) => runInode(input),
  };

  it("size changes the run and the view contract holds", () => {
    expect(buildAlgoSteps(def, 4, 1)).not.toEqual(buildAlgoSteps(def, 5, 1));
    const view: ComponentType<{ state: InodeState }> = InodeView;
    expect(view).toBe(InodeView);
  });
});
