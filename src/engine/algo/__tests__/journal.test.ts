import { buildAlgoSteps } from "@/engine/algo/build";
import {
  JOURNAL_COUNTERS,
  runJournal,
  type JournalConfig,
  type JournalOp,
} from "@/engine/algo/journal";
import type { AlgoDef } from "@/engine/algo/types";
import type { JournalState } from "@/engine/algo/views/journal";
import { JournalView } from "@/engine/algo/views/JournalView";
import type { ComponentType } from "react";
import { describe, expect, it } from "vitest";

const UNORDERED: JournalOp[] = [
  { kind: "data", block: 0 },
  { kind: "meta", inode: "file", block: 0 },
];
const JOURNALED: JournalOp[] = [
  { kind: "data", block: 0 },
  { kind: "jwrite", inode: "file", block: 0 },
  { kind: "jforce" },
  { kind: "meta", inode: "file", block: 0 },
];

const last = (cfg: JournalConfig) => runJournal(cfg).at(-1)!;

describe("runJournal", () => {
  it("unordered crash after data orphans the block", () => {
    const { state } = last({ policy: "unordered", ops: UNORDERED, crashAfter: 1 });
    expect(state.orphan).toBe(true);
    expect(state.dataOnDisk).toEqual([0]);
    expect(state.inodeOnDisk).toEqual([]);
  });

  it("unordered crash after both writes is consistent", () => {
    const { state } = last({ policy: "unordered", ops: UNORDERED, crashAfter: 2 });
    expect(state.orphan).toBe(false);
    expect(state.inodeOnDisk).toEqual([0]);
  });

  it("journal crash after force recovers the inode", () => {
    const { state } = last({ policy: "journal", ops: JOURNALED, crashAfter: 3 });
    expect(state.orphan).toBe(false);
    expect(state.inodeOnDisk).toEqual([0]);
  });

  it("never aliases a frame", () => {
    const steps = runJournal({ policy: "journal", ops: JOURNALED, crashAfter: 4 });
    expect(new Set(steps.map((s) => s.state)).size).toBe(steps.length);
  });
});

describe("journal rides on archetype B", () => {
  const def: AlgoDef<JournalState, JournalConfig> = {
    id: "fsj",
    title: "journal",
    code: ["write data", "write inode", "journal", "force", "-- crash --", "replay"],
    counters: [
      { key: JOURNAL_COUNTERS.dataWrites, label: "data writes" },
      { key: JOURNAL_COUNTERS.metaWrites, label: "inode writes" },
    ],
    size: { label: "ops before crash", min: 0, max: 4, default: 1 },
    generateInput: (_rng, size) => ({
      policy: "journal",
      ops: JOURNALED,
      crashAfter: size,
    }),
    run: (input) => runJournal(input),
  };

  it("size is the crash point and the view contract holds", () => {
    expect(buildAlgoSteps(def, 1, 1)).not.toEqual(buildAlgoSteps(def, 3, 1));
    const view: ComponentType<{ state: JournalState }> = JournalView;
    expect(view).toBe(JournalView);
  });
});
