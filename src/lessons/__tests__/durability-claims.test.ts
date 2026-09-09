import { buildAlgoSteps } from "@/engine/algo/build";
import type { AlgoDef } from "@/engine/algo/types";
import { WAL_COUNTERS as C } from "@/engine/algo/wal";
import type { WalState } from "@/engine/algo/views/wal";
import {
  checkpointsAlgo,
  noCheckpointAlgo,
} from "@/lessons/durability/checkpoints";
import {
  groupCommitAlgo,
  perCommitAlgo,
} from "@/lessons/durability/group-commit";
import {
  pagesOnlyAlgo,
  writeAheadLoggingAlgo,
} from "@/lessons/durability/write-ahead-logging";
import { describe, expect, it } from "vitest";

/**
 * The durability module's prose states numbers. A failure here means a lesson
 * page now lies, and the message should name the sentence that became untrue.
 *
 * Both lessons drive `runWal` with the crash point as the SIZE argument, so every
 * claim reads "at crash point N, the page says X".
 */

function at<I>(def: AlgoDef<WalState, I>, crashAfter: number) {
  const steps = buildAlgoSteps(def, crashAfter, 42);
  const final = steps[steps.length - 1];
  const crash = steps.find((s) => s.state.phase === "crash");
  return {
    steps,
    state: final.state,
    disk: Object.fromEntries(final.state.pages.map((p) => [p.id, p.disk])) as Record<
      string,
      number
    >,
    counters: final.counters,
    /** Counters as of the power failure — before recovery does any work. */
    atCrash: crash?.counters ?? {},
    redone: final.state.log.filter((r) => r.redone).length,
    undone: final.state.log.filter((r) => r.undone).length,
  };
}

// ---------------------------------------------------------------------------
// write-ahead-logging
// ---------------------------------------------------------------------------

/** The eight positions that lesson's slider offers. */
const POINTS = [0, 1, 2, 3, 4, 5, 6, 7];

describe("write-ahead-logging · the slider covers eight real crash points", () => {
  it("offers 0 through 7, and every one of them crashes", () => {
    // The page says "drag from 0 up to 7" and "the eight crash points".
    for (const def of [pagesOnlyAlgo, writeAheadLoggingAlgo]) {
      expect(def.size).toMatchObject({ min: 0, max: 7 });
      for (const c of POINTS) {
        expect(at(def, c).steps.some((s) => s.state.phase === "crash")).toBe(true);
      }
    }
  });
});

describe("write-ahead-logging · 'without a log' claims", () => {
  it("loses acknowledged work at five of the eight crash points", () => {
    const lost = POINTS.filter((c) => at(pagesOnlyAlgo, c).state.lostCommit);
    expect(lost).toHaveLength(5);
    // "It is safe only at 0, 1 and 2."
    expect(POINTS.filter((c) => !at(pagesOnlyAlgo, c).state.lostCommit)).toEqual([0, 1, 2]);
  });

  it("is safe at 0, 1 and 2 only because nothing had been promised", () => {
    for (const c of [0, 1, 2]) {
      expect(at(pagesOnlyAlgo, c).state.txns.every((t) => !t.acknowledged)).toBe(true);
    }
    // ...and the moment something IS promised, it breaks.
    expect(at(pagesOnlyAlgo, 3).state.txns[0].acknowledged).toBe(true);
  });

  it("fails in exactly the three shapes the page names", () => {
    // "Crash at 3 and the commit has vanished entirely — the disk still reads
    // 100 and 0."
    expect(at(pagesOnlyAlgo, 3).disk).toEqual({ balance: 100, audit: 0 });
    // "Crash at 4 or 5 and it is torn: balance 150 and audit 0."
    expect(at(pagesOnlyAlgo, 4).disk).toEqual({ balance: 150, audit: 0 });
    expect(at(pagesOnlyAlgo, 5).disk).toEqual({ balance: 150, audit: 0 });
    // "Crash at 6 or 7 and the balance holds 90."
    expect(at(pagesOnlyAlgo, 6).disk.balance).toBe(90);
    expect(at(pagesOnlyAlgo, 7).disk.balance).toBe(90);
  });

  it("has 90 come from a transaction that never committed", () => {
    // The insight callout: "a number no committed transaction ever produced",
    // with "nothing on this disk records what the value used to be".
    const { state } = at(pagesOnlyAlgo, 6);
    expect(state.txns.find((t) => t.id === "T2")?.acknowledged).toBe(false);
    expect(state.violation).toContain("uncommitted T2");
    expect(state.log).toHaveLength(0);
  });

  it("never logs or forces anything, at any crash point", () => {
    for (const c of POINTS) {
      const { counters } = at(pagesOnlyAlgo, c);
      expect(counters[C.logRecords] ?? 0).toBe(0);
      expect(counters[C.fsyncs] ?? 0).toBe(0);
      expect(counters[C.repaired] ?? 0).toBe(0);
    }
  });
});

describe("write-ahead-logging · 'with a log' claims", () => {
  it("loses acknowledged work at zero of the eight crash points", () => {
    expect(POINTS.filter((c) => at(writeAheadLoggingAlgo, c).state.lostCommit)).toEqual([]);
  });

  it("ends at balance 150 and audit 1 from crash 3 to crash 7", () => {
    for (const c of [3, 4, 5, 6, 7]) {
      expect(at(writeAheadLoggingAlgo, c).disk).toEqual({ balance: 150, audit: 1 });
    }
  });

  it("appends the record before the pool moves", () => {
    // "The record appears above the durability line BEFORE the pool value moves.
    // That order is the entire mechanism."
    const { steps } = at(writeAheadLoggingAlgo, 1);
    const appended = steps.findIndex((s) => s.state.log.length === 1);
    const moved = steps.findIndex((s) => s.state.pages[0].buffered === 150);
    expect(appended).toBeGreaterThan(0);
    expect(appended).toBeLessThan(moved);
    expect(steps[appended].state.pages[0].buffered).toBe(100);
  });

  it("charges one force and zero page writes for the commit", () => {
    // "modified two pages, has written ZERO of them to disk, and has performed
    // exactly ONE sequential force ... the disk still reads balance 100 and
    // audit 0."
    const { steps } = at(writeAheadLoggingAlgo, 3);
    const success = steps.find((s) => s.state.txns[0].acknowledged)!;
    expect(success.counters[C.fsyncs]).toBe(1);
    expect(success.counters[C.pageWrites] ?? 0).toBe(0);
    expect(Object.fromEntries(success.state.pages.map((p) => [p.id, p.disk]))).toEqual({
      balance: 100,
      audit: 0,
    });
    // Two pages modified in the pool, neither of them durable.
    expect(success.state.pages.filter((p) => p.dirty)).toHaveLength(2);
  });

  it("tells T1 it succeeded only AFTER the force, never before", () => {
    // "One fsync carries the records below the line, and only THEN is T1 told it
    // succeeded." Reporting success before the fsync is the classic durability
    // bug, and it is invisible in the final state — it has to be asserted on the
    // frame where the commit record exists but is not yet durable.
    const { steps } = at(writeAheadLoggingAlgo, 3);
    const appended = steps.find((s) => s.state.log.some((r) => r.kind === "commit"))!;
    expect(appended.state.flushedUpTo).toBe(0);
    expect(appended.state.txns[0].acknowledged).toBe(false);

    const forced = steps.find((s) => s.state.txns[0].acknowledged)!;
    expect(forced.state.log.filter((r) => r.durable).length).toBeGreaterThan(0);
    expect(forced.state.flushedUpTo).toBe(3);
  });

  it("applies 2 records at crash 3 and 1 at crash 4", () => {
    // The idempotence callout, quoted exactly.
    expect(at(writeAheadLoggingAlgo, 3).counters[C.repaired]).toBe(2);
    expect(at(writeAheadLoggingAlgo, 4).counters[C.repaired]).toBe(1);
    // "one fewer, because by then the balance page had already reached disk"
    const crash4 = at(writeAheadLoggingAlgo, 4);
    expect(crash4.atCrash[C.pageWrites]).toBe(1);
  });

  it("repairs entirely by undo at crash 7, and is still correct", () => {
    // "At crash 7 redo skips everything and undo does the whole repair."
    const { redone, undone, disk } = at(writeAheadLoggingAlgo, 7);
    expect(redone).toBe(0);
    expect(undone).toBe(1);
    expect(disk).toEqual({ balance: 150, audit: 1 });
  });
});

describe("write-ahead-logging · 'the ordering rule' claims", () => {
  it("never lets a page's durable content outrun the durable log", () => {
    // "it holds on every frame of every crash point: no page's durable content
    // is ever newer than the durable log prefix."
    for (const c of POINTS) {
      for (const step of at(writeAheadLoggingAlgo, c).steps) {
        for (const page of step.state.pages) {
          expect(page.diskLsn).toBeLessThanOrEqual(step.state.flushedUpTo);
        }
      }
    }
  });

  it("spends one extra fsync at crash point 6", () => {
    // "a flush that outruns the log forces the log first. In this run that costs
    // one extra fsync, at crash point 6."
    expect(at(writeAheadLoggingAlgo, 5).atCrash[C.fsyncs]).toBe(1);
    expect(at(writeAheadLoggingAlgo, 6).atCrash[C.fsyncs]).toBe(2);
  });

  it("adds five records and three forces over the same three page writes", () => {
    // The warning callout. Compared at the CRASH, before recovery does work
    // the naive policy never gets the chance to do.
    const wal = at(writeAheadLoggingAlgo, 7).atCrash;
    const bare = at(pagesOnlyAlgo, 7).atCrash;
    expect(wal[C.logRecords]).toBe(5);
    expect(wal[C.fsyncs]).toBe(3);
    expect(wal[C.pageWrites]).toBe(3);
    expect(bare[C.pageWrites]).toBe(3);
    expect(bare[C.logRecords] ?? 0).toBe(0);
  });

  it("produces identical disks at 0, 1 and 2 under both policies", () => {
    // "at crash points 0, 1 and 2 the two policies produce identical disks."
    for (const c of [0, 1, 2]) {
      expect(at(writeAheadLoggingAlgo, c).disk).toEqual(at(pagesOnlyAlgo, c).disk);
    }
    // And they diverge from 3 onward, which is where the promise starts.
    expect(at(writeAheadLoggingAlgo, 3).disk).not.toEqual(at(pagesOnlyAlgo, 3).disk);
  });
});

// ---------------------------------------------------------------------------
// checkpoints
// ---------------------------------------------------------------------------

/** The ten positions the checkpoint lesson's slider offers. */
const CK_POINTS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

describe("checkpoints · the two runs are the same workload", () => {
  it("offers ten real crash points on both figures", () => {
    // "any of the ten crash points"
    for (const def of [noCheckpointAlgo, checkpointsAlgo]) {
      expect(def.size).toMatchObject({ min: 0, max: 9 });
      for (const c of CK_POINTS) {
        expect(at(def, c).steps.some((s) => s.state.phase === "crash")).toBe(true);
      }
    }
  });

  it("differs ONLY in whether the checkpoint was taken", () => {
    // "The identical ten operations" — so the comparison at a given crash point
    // has to be a comparison of the same work. Before the checkpoint op runs,
    // the two runs must be indistinguishable.
    for (const c of [0, 1, 2, 3, 4]) {
      expect(at(noCheckpointAlgo, c).disk).toEqual(at(checkpointsAlgo, c).disk);
      expect(at(noCheckpointAlgo, c).counters[C.scanned] ?? 0).toBe(
        at(checkpointsAlgo, c).counters[C.scanned] ?? 0,
      );
    }
    // The checkpoint is operation 5, so 5 is the first crash point that can differ.
    expect(at(noCheckpointAlgo, 5).counters[C.scanned]).not.toBe(
      at(checkpointsAlgo, 5).counters[C.scanned],
    );
  });

  it("writes a checkpoint record only when the policy takes one", () => {
    expect(at(checkpointsAlgo, 9).state.log.filter((r) => r.kind === "checkpoint")).toHaveLength(1);
    expect(at(noCheckpointAlgo, 9).state.log.filter((r) => r.kind === "checkpoint")).toHaveLength(0);
  });
});

describe("checkpoints · 'without a checkpoint' claims", () => {
  it("considers 8 records and applies 4 at crash 9", () => {
    const { counters } = at(noCheckpointAlgo, 9);
    expect(counters[C.scanned]).toBe(8);
    expect(counters[C.repaired]).toBe(4);
  });

  it("shrinks the scan only as the log shortens — 8, 6, 3", () => {
    // "The scan shrinks only because the log is shorter — 8, then 6, then 3.
    // Nothing bounds it but the crash."
    expect(at(noCheckpointAlgo, 9).counters[C.scanned]).toBe(8);
    expect(at(noCheckpointAlgo, 7).counters[C.scanned]).toBe(6);
    expect(at(noCheckpointAlgo, 5).counters[C.scanned]).toBe(3);
  });

  it("never writes a page during normal running", () => {
    // "page writes during the run: 0. This policy never pays anything up front."
    for (const c of CK_POINTS) {
      expect(at(noCheckpointAlgo, c).atCrash[C.pageWrites] ?? 0).toBe(0);
    }
  });

  it("is correct at every crash point", () => {
    // "no acknowledged commit is ever lost ... everything that follows is about
    // cost, not correctness."
    expect(CK_POINTS.filter((c) => at(noCheckpointAlgo, c).state.lostCommit)).toEqual([]);
  });
});

describe("checkpoints · 'with a checkpoint' claims", () => {
  it("considers 5 records and applies 3 at crash 9", () => {
    // "redo now considers 5 records instead of 8" and "Records applied falls
    // from 4 to 3". The two are different meters: `repaired` counts redo AND
    // undo, which is why the drop is smaller than the scan's.
    const { counters, redone, undone } = at(checkpointsAlgo, 9);
    expect(counters[C.scanned]).toBe(5);
    expect(counters[C.repaired]).toBe(3);
    expect(redone + undone).toBe(3);
  });

  it("starts redo at the checkpoint's own LSN", () => {
    // The mechanism, not just the number: the floor must BE the checkpoint.
    const { state } = at(checkpointsAlgo, 9);
    const checkpoint = state.log.find((r) => r.kind === "checkpoint")!;
    expect(checkpoint.lsn).toBe(5);
    const durable = state.log.filter((r) => r.durable);
    // 5 records scanned == the checkpoint record and everything after it.
    expect(durable.filter((r) => r.lsn >= checkpoint.lsn)).toHaveLength(5);
  });

  it("ends at 6 page writes against 4, and 5 forces against 3", () => {
    // "page writes ends at 6 against 4, log forces at 5 against 3" — the FINAL
    // meter values, which is what a reader sees without scrubbing.
    expect(at(checkpointsAlgo, 9).counters[C.pageWrites]).toBe(6);
    expect(at(noCheckpointAlgo, 9).counters[C.pageWrites]).toBe(4);
    expect(at(checkpointsAlgo, 9).counters[C.fsyncs]).toBe(5);
    expect(at(noCheckpointAlgo, 9).counters[C.fsyncs]).toBe(3);
  });

  it("has spent 3 of those page writes BEFORE the crash, against 0", () => {
    // "Scrub back to the power-failure frame: page writes reads 3 there, against
    // 0 — three writes paid while nothing was wrong." A different number from the
    // final meter, so it needs its own claim.
    expect(at(checkpointsAlgo, 9).atCrash[C.pageWrites]).toBe(3);
    expect(at(noCheckpointAlgo, 9).atCrash[C.pageWrites] ?? 0).toBe(0);
  });

  it("replays nothing at all at crash 5", () => {
    // "Set the crash to 5, immediately after the checkpoint. Redo replays
    // nothing at all: everything committed is already on disk."
    expect(at(checkpointsAlgo, 5).redone).toBe(0);
  });

  it("reaches the same disk as the run without a checkpoint", () => {
    // "Both figures end with the same disk — orders 2, stock 18, ledger 0."
    expect(at(checkpointsAlgo, 9).disk).toEqual({ orders: 2, stock: 18, ledger: 0 });
    expect(at(noCheckpointAlgo, 9).disk).toEqual({ orders: 2, stock: 18, ledger: 0 });
  });

  it("is correct at every crash point", () => {
    expect(CK_POINTS.filter((c) => at(checkpointsAlgo, c).state.lostCommit)).toEqual([]);
  });
});

describe("checkpoints · 'why undo cannot start there' claims", () => {
  it("undoes a record from BEFORE the checkpoint", () => {
    // "T4 dirtied the ledger page at LSN 4, one record before the checkpoint ...
    // Recovery has to reach back past its own floor to undo LSN 4."
    const { state } = at(checkpointsAlgo, 9);
    const checkpoint = state.log.find((r) => r.kind === "checkpoint")!;
    const undone = state.log.filter((r) => r.undone);
    expect(undone).toHaveLength(1);
    expect(undone[0]).toMatchObject({ lsn: 4, txn: "T4", page: "ledger", before: 0, after: 9 });
    expect(undone[0].lsn).toBeLessThan(checkpoint.lsn);
  });

  it("has the checkpoint itself put the uncommitted value on disk", () => {
    // The causal step the callout depends on: without the checkpoint, T4's page
    // never reaches disk and there is nothing to undo.
    const withCk = at(checkpointsAlgo, 9);
    const without = at(noCheckpointAlgo, 9);
    expect(withCk.state.txns.find((t) => t.id === "T4")?.acknowledged).toBe(false);
    expect(without.undone).toBe(0);
    expect(withCk.undone).toBe(1);
  });

  it("trades 4 redone / 0 undone for 2 redone / 1 undone", () => {
    // "Redo dropped from 4 to 2 and undo rose from 0 to 1."
    expect(at(noCheckpointAlgo, 9).redone).toBe(4);
    expect(at(noCheckpointAlgo, 9).undone).toBe(0);
    expect(at(checkpointsAlgo, 9).redone).toBe(2);
    expect(at(checkpointsAlgo, 9).undone).toBe(1);
  });

  it("would leave the uncommitted value on disk if undo stopped at the floor", () => {
    // "had undo stopped at the checkpoint the way redo does, T4's uncommitted
    // value would have stayed on disk forever." Asserted by construction: the
    // only record that needed undoing sits below the floor, so a floor-bounded
    // undo would have found nothing.
    const { state } = at(checkpointsAlgo, 9);
    const floor = state.log.find((r) => r.kind === "checkpoint")!.lsn;
    const needed = state.log.filter((r) => r.undone);
    expect(needed.every((r) => r.lsn < floor)).toBe(true);
    expect(state.pages.find((p) => p.id === "ledger")?.disk).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// group-commit
// ---------------------------------------------------------------------------

/** The eight positions the group-commit slider offers. */
const GC_POINTS = [0, 1, 2, 3, 4, 5, 6, 7];

/** The first crash point at which `txn` has been told it succeeded. */
function answeredAt<I>(def: AlgoDef<WalState, I>, txn: string): number {
  for (const c of GC_POINTS) {
    const t = at(def, c).state.txns.find((x) => x.id === txn);
    if (t?.acknowledged) return c;
  }
  return -1;
}

describe("group-commit · the two runs are the same workload", () => {
  it("appends the same six records either way", () => {
    // "Compare the log records meter across both figures. It reads 6 either way."
    expect(at(perCommitAlgo, 6).atCrash[C.logRecords]).toBe(6);
    expect(at(groupCommitAlgo, 6).atCrash[C.logRecords]).toBe(6);
    expect(at(perCommitAlgo, 7).atCrash[C.logRecords]).toBe(
      at(groupCommitAlgo, 7).atCrash[C.logRecords],
    );
  });

  it("offers eight real crash points on both figures", () => {
    for (const def of [perCommitAlgo, groupCommitAlgo]) {
      expect(def.size).toMatchObject({ min: 0, max: 7 });
      for (const c of GC_POINTS) {
        expect(at(def, c).steps.some((s) => s.state.phase === "crash")).toBe(true);
      }
    }
  });
});

describe("group-commit · 'answering immediately' claims", () => {
  it("spends three forces for three transactions", () => {
    // "At crash 6, the forces meter reads 3 — one per transaction."
    expect(at(perCommitAlgo, 6).atCrash[C.fsyncs]).toBe(3);
    expect(at(perCommitAlgo, 6).state.txns.filter((t) => t.acknowledged)).toHaveLength(3);
  });

  it("answers T1 at crash 2, T2 at 4 and T3 at 6", () => {
    // "T1 is answered from crash 2, T2 from 4, T3 from 6."
    expect(answeredAt(perCommitAlgo, "T1")).toBe(2);
    expect(answeredAt(perCommitAlgo, "T2")).toBe(4);
    expect(answeredAt(perCommitAlgo, "T3")).toBe(6);
  });

  it("makes each transaction durable without waiting for the others", () => {
    // "never waits for anybody" — at crash 2 exactly one is answered, and its
    // work is on disk while the others' is not.
    const s = at(perCommitAlgo, 2);
    expect(s.state.txns.filter((t) => t.acknowledged).map((t) => t.id)).toEqual(["T1"]);
    expect(s.disk).toEqual({ orders: 1, stock: 20, ledger: 0 });
  });
});

describe("group-commit · 'one force for the batch' claims", () => {
  it("spends one force for three transactions", () => {
    // "forces meter: 1" against three answered transactions.
    expect(at(groupCommitAlgo, 7).atCrash[C.fsyncs]).toBe(1);
    expect(at(groupCommitAlgo, 7).state.txns.filter((t) => t.acknowledged)).toHaveLength(3);
  });

  it("leaves all three committing with an empty durable prefix at crash 6", () => {
    // "all three say committing, and the forced-log row is empty. Six records
    // exist and none are durable."
    const { steps } = at(groupCommitAlgo, 6);
    const lastRunning = steps.filter((s) => s.state.phase === "run").at(-1)!;
    expect(lastRunning.state.txns.map((t) => t.status)).toEqual([
      "committing",
      "committing",
      "committing",
    ]);
    expect(lastRunning.state.txns.every((t) => !t.acknowledged)).toBe(true);
    expect(lastRunning.state.flushedUpTo).toBe(0);
    expect(lastRunning.state.log).toHaveLength(6);
    expect(lastRunning.state.log.every((r) => !r.durable)).toBe(true);
  });

  it("forces nothing at all before the batch", () => {
    for (const c of [0, 1, 2, 3, 4, 5, 6]) {
      expect(at(groupCommitAlgo, c).atCrash[C.fsyncs] ?? 0).toBe(0);
    }
  });

  it("answers all three at the same crash point", () => {
    // "answers all three at once", and not before.
    expect(answeredAt(groupCommitAlgo, "T1")).toBe(7);
    expect(answeredAt(groupCommitAlgo, "T2")).toBe(7);
    expect(answeredAt(groupCommitAlgo, "T3")).toBe(7);
  });
});

describe("group-commit · 'latency, not safety' claims", () => {
  it("loses acknowledged work under neither policy, at any crash point", () => {
    // "across all eight crash points, NEITHER policy ever loses acknowledged
    // work." The claim the whole last section rests on.
    for (const def of [perCommitAlgo, groupCommitAlgo]) {
      expect(GC_POINTS.filter((c) => at(def, c).state.lostCommit)).toEqual([]);
    }
  });

  it("discards six records and three transactions at crash 6 without breaking a promise", () => {
    // "six records gone, three finished transactions destroyed. It is not a loss."
    const { state, disk } = at(groupCommitAlgo, 6);
    expect(state.log.filter((r) => r.lost)).toHaveLength(6);
    expect(state.txns.filter((t) => t.status === "lost")).toHaveLength(3);
    expect(state.lostCommit ?? false).toBe(false);
    // Nothing had been promised, so the disk is back to its opening values and
    // that is the CORRECT outcome, not a failure to recover.
    expect(disk).toEqual({ orders: 0, stock: 20, ledger: 0 });
  });

  it("costs T1 five crash points of latency", () => {
    // "T1 was answered at crash point 2. Under grouping it is answered at 7 —
    // five operations later."
    expect(answeredAt(groupCommitAlgo, "T1") - answeredAt(perCommitAlgo, "T1")).toBe(5);
  });

  it("reaches the identical disk once the batch is forced", () => {
    // Same guarantee, different schedule.
    expect(at(groupCommitAlgo, 7).disk).toEqual(at(perCommitAlgo, 7).disk);
    expect(at(groupCommitAlgo, 7).disk).toEqual({ orders: 1, stock: 19, ledger: 5 });
    expect(at(groupCommitAlgo, 7).counters[C.repaired]).toBe(
      at(perCommitAlgo, 7).counters[C.repaired],
    );
  });
});
