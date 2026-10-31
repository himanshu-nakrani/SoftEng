import { buildAlgoSteps } from "@/engine/algo/build";
import { JOURNAL_COUNTERS as C } from "@/engine/algo/journal";
import type { AlgoDef } from "@/engine/algo/types";
import type { JournalState } from "@/engine/algo/views/journal";
import {
  fsJournalingAlgo,
  fsJournalingUnorderedAlgo,
} from "@/lessons/storage-io/fs-journaling";
import { describe, expect, it } from "vitest";

/**
 * The fs-journaling prose states numbers. A failure here means the page now
 * lies, and the message should name the sentence that became untrue.
 *
 * Both figures drive `runJournal` with the crash point as the SIZE argument.
 */

function at<I>(def: AlgoDef<JournalState, I>, crashAfter: number) {
  const steps = buildAlgoSteps(def, crashAfter, 42);
  const final = steps[steps.length - 1]!;
  const crash = steps.find((s) => s.state.phase === "crash");
  return {
    steps,
    state: final.state,
    counters: final.counters,
    atCrash: crash,
    recover: steps.filter((s) => s.state.phase === "recover"),
  };
}

const UNORDERED_POINTS = [0, 1, 2] as const;
const JOURNAL_POINTS = [0, 1, 2, 3, 4] as const;

describe("fs-journaling · the slider is the crash point", () => {
  it("offers 0 through 2 unordered and 0 through 4 journaled, and every position crashes", () => {
    // "The slider is not a size — it is where the power fails."
    expect(fsJournalingUnorderedAlgo.size).toMatchObject({
      min: 0,
      max: 2,
      default: 1,
    });
    expect(fsJournalingAlgo.size).toMatchObject({ min: 0, max: 4, default: 3 });
    for (const c of UNORDERED_POINTS) {
      expect(at(fsJournalingUnorderedAlgo, c).atCrash).toBeDefined();
    }
    for (const c of JOURNAL_POINTS) {
      expect(at(fsJournalingAlgo, c).atCrash).toBeDefined();
    }
  });
});

describe("fs-journaling · unordered claims", () => {
  it("crash 1 leaves block 0 on disk with an empty inode — an orphan", () => {
    // "Leave the crash at 1. Data on disk is b0, the inode is empty.
    // Step past the crash: the verdict is an orphan."
    const { state } = at(fsJournalingUnorderedAlgo, 1);
    expect(state.orphan).toBe(true);
    expect(state.dataOnDisk).toEqual([0]);
    expect(state.inodeOnDisk).toEqual([]);
  });

  it("crash 2 is consistent: the inode names 0", () => {
    // "Drag to 2. Both writes completed. The inode names 0, and the
    // verdict is consistent."
    const { state } = at(fsJournalingUnorderedAlgo, 2);
    expect(state.orphan).toBe(false);
    expect(state.dataOnDisk).toEqual([0]);
    expect(state.inodeOnDisk).toEqual([0]);
  });

  it("crash 0 is safe only because nothing had been written", () => {
    // "Drag to 0. Nothing reached disk. The only crash that is safe,
    // and only because nothing had been written yet."
    const { state } = at(fsJournalingUnorderedAlgo, 0);
    expect(state.orphan).toBe(false);
    expect(state.dataOnDisk).toEqual([]);
    expect(state.inodeOnDisk).toEqual([]);
  });

  it("orphans at one of the three crash points — crash 1", () => {
    // "Across the three crash points, this policy orphans at one of
    // them — crash 1."
    const orphaned = UNORDERED_POINTS.filter(
      (c) => at(fsJournalingUnorderedAlgo, c).state.orphan,
    );
    expect(orphaned).toEqual([1]);
  });

  it("never journals, forces, or recovers, at any crash point", () => {
    // "There is no recovery pass. Journal writes and journal forces stay at 0."
    for (const c of UNORDERED_POINTS) {
      const run = at(fsJournalingUnorderedAlgo, c);
      expect(run.counters[C.journalWrites] ?? 0).toBe(0);
      expect(run.counters[C.forces] ?? 0).toBe(0);
      expect(run.recover).toHaveLength(0);
    }
  });
});

describe("fs-journaling · journaled claims", () => {
  it("crash 3 — after the force, before the inode write — recovers the name", () => {
    // "Leave the crash at 3. ... Recovery replays the forced record and
    // the inode names 0."
    const run = at(fsJournalingAlgo, 3);
    expect(run.atCrash!.state.orphan).toBe(true);
    expect(run.atCrash!.state.inodeOnDisk).toEqual([]);
    expect(run.atCrash!.state.dataOnDisk).toEqual([0]);
    expect(run.atCrash!.counters[C.forces]).toBe(1);
    expect(run.atCrash!.counters[C.metaWrites] ?? 0).toBe(0);
    expect(run.recover).toHaveLength(1);
    expect(run.state.orphan).toBe(false);
    expect(run.state.inodeOnDisk).toEqual([0]);
  });

  it("crash 2 still orphans because the journal record is not forced", () => {
    // "Drag to 2. The journal chip is hollow (unforced). Recovery does not
    // run. Still an orphan. Appended is not durable."
    const run = at(fsJournalingAlgo, 2);
    expect(run.state.journal).toEqual([
      { inode: "file", block: 0, forced: false },
    ]);
    expect(run.recover).toHaveLength(0);
    expect(run.state.orphan).toBe(true);
    expect(run.state.inodeOnDisk).toEqual([]);
  });

  it("crash 1 still orphans because the data block is never in the journal", () => {
    // "Drag to 1: data is on disk, the journal is empty, still an orphan —
    // this model does not journal data."
    const run = at(fsJournalingAlgo, 1);
    expect(run.state.dataOnDisk).toEqual([0]);
    expect(run.state.journal).toEqual([]);
    expect(run.state.orphan).toBe(true);
    expect(run.state.inodeOnDisk).toEqual([]);
    expect(run.recover).toHaveLength(0);
  });

  it("crash 4: the inode write completed before the crash, already consistent", () => {
    // "Then drag to 4: the inode write itself completed before the crash,
    // and the file is already consistent."
    const run = at(fsJournalingAlgo, 4);
    expect(run.atCrash!.state.orphan).toBe(false);
    expect(run.atCrash!.state.inodeOnDisk).toEqual([0]);
    expect(run.state.orphan).toBe(false);
    expect(run.state.inodeOnDisk).toEqual([0]);
  });

  it("the force is the durability point, not the inode write", () => {
    // "At crash 3 the inode has not been written — inode writes at the crash
    // is 0 — and recovery still names block 0. One sequential force made
    // the name durable."
    const crash3 = at(fsJournalingAlgo, 3);
    expect(crash3.atCrash!.counters[C.forces]).toBe(1);
    expect(crash3.atCrash!.counters[C.metaWrites] ?? 0).toBe(0);
    expect(crash3.atCrash!.counters[C.dataWrites]).toBe(1);
    expect(crash3.atCrash!.counters[C.journalWrites]).toBe(1);
    expect(crash3.counters[C.metaWrites]).toBe(1);
    expect(crash3.state.inodeOnDisk).toEqual([0]);
  });

  it("a record that has been appended but not forced cannot be replayed", () => {
    // "A record that has been appended but not forced cannot be replayed,
    // which is why crash 2 still orphans. A record that has been forced
    // can, which is why crash 3 does not."
    expect(at(fsJournalingAlgo, 2).state.orphan).toBe(true);
    expect(at(fsJournalingAlgo, 3).state.orphan).toBe(false);
  });

  it("crash 1 orphans under both policies — the data is never journaled", () => {
    // "Crash 1 orphans under both policies, because the bytes reached disk
    // and the name did not, and there is no log record of either."
    expect(at(fsJournalingUnorderedAlgo, 1).state.orphan).toBe(true);
    expect(at(fsJournalingAlgo, 1).state.orphan).toBe(true);
    expect(at(fsJournalingAlgo, 1).state.journal).toEqual([]);
  });
});
