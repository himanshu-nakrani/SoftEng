import { buildAlgoSteps } from "@/engine/algo/build";
import type { AlgoDef } from "@/engine/algo/types";
import { WAL_COUNTERS, runWal, type WalPolicy, type WalScript } from "@/engine/algo/wal";
import type { WalState } from "@/engine/algo/views/wal";
import { WalView } from "@/engine/algo/views/WalView";
import type { ComponentType } from "react";
import { describe, expect, it } from "vitest";

/**
 * The script both policies run. T1 touches two pages and commits; T2 then starts
 * changing one of them and never finishes, so the run contains both things
 * recovery has to be able to do — replay work that was acknowledged, and remove
 * work that was not.
 */
const OPS: WalScript["ops"] = [
  { kind: "write", txn: "T1", page: "balance", value: 150 },
  { kind: "write", txn: "T1", page: "audit", value: 1 },
  { kind: "commit", txn: "T1" },
  { kind: "flush", page: "balance" },
  { kind: "write", txn: "T2", page: "balance", value: 90 },
  { kind: "flush", page: "balance" },
  { kind: "checkpoint" },
  { kind: "write", txn: "T2", page: "audit", value: 2 },
];

/** The first crash point at which T1 has already reported success. */
const AFTER_COMMIT = 3;

function script(policy: WalPolicy, crashAfter: number): WalScript {
  return {
    pages: { balance: 100, audit: 0 },
    txns: [
      { id: "T1", name: "T1 · transfer" },
      { id: "T2", name: "T2 · adjustment" },
    ],
    ops: OPS,
    crashAfter,
    policy,
  };
}

const last = (steps: { state: WalState }[]) => steps[steps.length - 1].state;
const disk = (state: WalState) =>
  Object.fromEntries(state.pages.map((p) => [p.id, p.disk]));

/** Every crash point the figure offers — all of them a real power failure. */
const CRASH_POINTS = Array.from({ length: OPS.length }, (_, i) => i);

describe("runWal", () => {
  it("is deterministic and starts from the untouched input", () => {
    const steps = runWal(script("write-ahead", 4));
    expect(steps).toEqual(runWal(script("write-ahead", 4)));

    const first = steps[0].state;
    expect(first.phase).toBe("run");
    expect(disk(first)).toEqual({ balance: 100, audit: 0 });
    expect(first.pages.every((p) => p.buffered === p.disk && !p.dirty)).toBe(true);
    expect(first.log).toHaveLength(0);
  });

  it("never aliases a frame, so stepping back shows the log as it was", () => {
    const steps = runWal(script("write-ahead", 6));
    expect(new Set(steps.map((s) => s.state)).size).toBe(steps.length);
    expect(new Set(steps.map((s) => s.state.log)).size).toBe(steps.length);
    expect(new Set(steps.map((s) => s.state.pages)).size).toBe(steps.length);
    // The durability flags mutate as the run proceeds. If records were shared,
    // the first frame would already show the whole log forced.
    expect(steps[1].state.log.every((r) => !r.durable)).toBe(true);
  });

  it("keeps counters monotonic and code lines in range", () => {
    for (const policy of ["pages-only", "write-ahead"] as const) {
      for (const c of CRASH_POINTS) {
        const steps = runWal(script(policy, c));
        const totals: Record<string, number> = {};
        for (const step of steps) {
          for (const [key, value] of Object.entries(step.counters)) {
            expect(value).toBeGreaterThanOrEqual(totals[key] ?? 0);
            totals[key] = value;
          }
          if (step.codeLine !== undefined) {
            expect(step.codeLine).toBeGreaterThanOrEqual(0);
            expect(step.codeLine).toBeLessThan(8);
          }
        }
      }
    }
  });

  it("only counts the log records it actually appended", () => {
    // The policy contrast has to be visible in the counters, not just the prose.
    expect(last(runWal(script("pages-only", 8))).log).toHaveLength(0);
    const walSteps = runWal(script("write-ahead", 8));
    expect(walSteps[walSteps.length - 1].counters[WAL_COUNTERS.logRecords]).toBe(6);
    const bare = runWal(script("pages-only", 8));
    expect(bare[bare.length - 1].counters[WAL_COUNTERS.logRecords] ?? 0).toBe(0);
    expect(bare[bare.length - 1].counters[WAL_COUNTERS.fsyncs] ?? 0).toBe(0);
  });
});

describe("the write-ahead rule", () => {
  it("never lets a page reach disk ahead of the records describing it", () => {
    // The invariant the whole design rests on, checked on every frame of every
    // crash point: if a page's durable content is newer than the forced log
    // prefix, recovery could not undo it.
    for (const c of CRASH_POINTS) {
      for (const step of runWal(script("write-ahead", c))) {
        for (const page of step.state.pages) {
          expect(page.diskLsn).toBeLessThanOrEqual(step.state.flushedUpTo);
        }
      }
    }
  });

  it("appends the record before the change it describes", () => {
    // Two frames, and the order between them IS the rule. Found by predicate
    // rather than index so splitting a frame later cannot silently pass.
    const steps = runWal(script("write-ahead", 1));
    const logged = steps.findIndex((s) => s.state.log.length === 1);
    const changed = steps.findIndex((s) => s.state.pages[0].buffered === 150);
    expect(logged).toBeGreaterThan(0);
    expect(logged).toBeLessThan(changed);
    // At the moment the record exists, the pool has NOT moved yet — which is
    // what makes the before-image trustworthy.
    expect(steps[logged].state.pages[0].buffered).toBe(100);
    expect(steps[logged].state.log[0]).toMatchObject({ before: 100, after: 150 });
  });

  it("forces the log before a page write when the prefix is behind", () => {
    // Op 5 flushes a page whose newest record (T2's write, LSN 4) is past the
    // prefix forced by T1's commit (LSN 3), so the flush has to fsync first.
    const steps = runWal(script("write-ahead", 6));
    const atFlush = steps.find((s) => s.state.flushedUpTo === 4);
    expect(atFlush).toBeDefined();
    expect(atFlush?.counters[WAL_COUNTERS.fsyncs]).toBe(2);
  });

  it("charges one sequential force for a commit, and no page writes at all", () => {
    // The argument for logging in one assertion: at the moment T1 reports
    // success it has touched two pages, neither of which is on disk.
    const steps = runWal(script("write-ahead", AFTER_COMMIT));
    const atForce = steps.find((s) => s.state.txns[0].acknowledged);
    expect(atForce).toBeDefined();
    expect(atForce?.counters[WAL_COUNTERS.fsyncs]).toBe(1);
    expect(atForce?.counters[WAL_COUNTERS.pageWrites] ?? 0).toBe(0);
    expect(disk(atForce!.state)).toEqual({ balance: 100, audit: 0 });
    // ...and it is nonetheless fully recoverable.
    expect(disk(last(steps))).toEqual({ balance: 150, audit: 1 });
  });

  it("does not acknowledge a commit whose record was never forced", () => {
    // The honest boundary of the promise: appended is not the same as durable.
    const steps = runWal(script("write-ahead", AFTER_COMMIT));
    const appended = steps.find((s) => s.state.log.some((r) => r.kind === "commit"));
    expect(appended?.state.txns[0].acknowledged).toBe(false);
    expect(appended?.state.flushedUpTo).toBe(0);
  });

  it("leaves an uncommitted value stranded on disk without a log", () => {
    // Op 5 writes T2's uncommitted page. With no before-image, nothing can
    // take it back — recorded as a violation rather than left to inference.
    const steps = runWal(script("pages-only", 6));
    expect(last(steps).violation).toContain("uncommitted T2");
    expect(disk(last(steps)).balance).toBe(90);
  });
});

describe("recovery", () => {
  it("brings back every acknowledged commit, from any crash point", () => {
    for (const c of CRASH_POINTS) {
      const state = last(runWal(script("write-ahead", c)));
      expect(state.lostCommit ?? false).toBe(false);
      // From the commit onward the answer is the same at every crash point,
      // which is the property "durable" actually means.
      if (c >= AFTER_COMMIT) expect(disk(state)).toEqual({ balance: 150, audit: 1 });
    }
  });

  it("loses acknowledged work at 5 of the 8 crash points without a log", () => {
    const lost = CRASH_POINTS.filter((c) => last(runWal(script("pages-only", c))).lostCommit);
    expect(CRASH_POINTS).toHaveLength(8);
    expect(lost).toEqual([3, 4, 5, 6, 7]);
    // Never before the commit: with nothing acknowledged there is nothing to lose.
    expect(lost.every((c) => c >= AFTER_COMMIT)).toBe(true);
  });

  it("fails in three distinct shapes without a log", () => {
    // Same policy, same script, three different kinds of wrong — which is why
    // "it might lose data" is too weak a description.
    expect(disk(last(runWal(script("pages-only", 3))))).toEqual({ balance: 100, audit: 0 });
    expect(disk(last(runWal(script("pages-only", 4))))).toEqual({ balance: 150, audit: 0 });
    expect(disk(last(runWal(script("pages-only", 6))))).toEqual({ balance: 90, audit: 0 });
  });

  it("skips a change already on disk, so redo is idempotent", () => {
    // Crashing one op later means `balance` was already written, so recovery
    // replays one record instead of two and reaches the same state.
    const early = last(runWal(script("write-ahead", 3)));
    const later = last(runWal(script("write-ahead", 4)));
    const repaired = (c: number) => {
      const steps = runWal(script("write-ahead", c));
      return steps[steps.length - 1].counters[WAL_COUNTERS.repaired];
    };
    expect(repaired(3)).toBe(2);
    expect(repaired(4)).toBe(1);
    expect(disk(early)).toEqual(disk(later));
  });

  it("undoes an uncommitted write that reached disk, using the before-image", () => {
    const steps = runWal(script("write-ahead", 6));
    const undone = last(steps).log.filter((r) => r.undone);
    expect(undone).toHaveLength(1);
    expect(undone[0]).toMatchObject({ txn: "T2", page: "balance", before: 150, after: 90 });
    expect(disk(last(steps)).balance).toBe(150);
  });

  it("marks the unforced tail as lost and its transaction as lost, not aborted", () => {
    const state = last(runWal(script("write-ahead", 5)));
    expect(state.log.filter((r) => r.lost).map((r) => r.lsn)).toEqual([4]);
    expect(state.txns.find((t) => t.id === "T2")?.status).toBe("lost");
    expect(state.txns.find((t) => t.id === "T1")?.status).toBe("committed");
  });

  it("agrees with the naive policy when nothing had committed yet", () => {
    // Honest boundary: logging buys nothing before the first commit, and the
    // lesson should not pretend otherwise.
    for (const c of [0, 1, 2]) {
      expect(disk(last(runWal(script("pages-only", c))))).toEqual(
        disk(last(runWal(script("write-ahead", c)))),
      );
    }
  });

  it("crashes and recovers at every point the figure offers", () => {
    // The slider's whole range must be meaningful: no position may skip the
    // crash, or the verdict on that frame would be about nothing.
    for (const c of CRASH_POINTS) {
      const steps = runWal(script("write-ahead", c));
      expect(steps.some((s) => s.state.phase === "crash")).toBe(true);
      expect(last(steps).phase).toBe("done");
    }
  });
});

describe("WAL rides on archetype B", () => {
  const def: AlgoDef<WalState, WalScript> = {
    id: "wal-durability",
    title: "write-ahead log",
    code: [
      "write page in pool",
      "log the change first",
      "COMMIT",
      "fsync log, not pages",
      "flush page to disk",
      "-- power fails --",
      "redo committed",
      "undo uncommitted",
    ],
    counters: [
      { key: WAL_COUNTERS.logRecords, label: "log records" },
      { key: WAL_COUNTERS.fsyncs, label: "log forces" },
      { key: WAL_COUNTERS.pageWrites, label: "page writes" },
      { key: WAL_COUNTERS.repaired, label: "records applied" },
    ],
    size: { label: "ops before the crash", min: 0, max: OPS.length, default: 4 },
    generateInput: (_rng, size) => script("write-ahead", size),
    run: (input) => runWal(input),
  };

  it("runs through buildAlgoSteps, reproducibly per size", () => {
    expect(buildAlgoSteps(def, 4, 42)).toEqual(buildAlgoSteps(def, 4, 42));
    // The size control IS the crash point, so changing it must change the run.
    expect(buildAlgoSteps(def, 4, 42)).not.toEqual(buildAlgoSteps(def, 6, 42));
  });

  it("ignores the seed, because a power failure is not a random event", () => {
    expect(buildAlgoSteps(def, 4, 1)).toEqual(buildAlgoSteps(def, 4, 999));
  });

  it("satisfies the view contract the figure requires", () => {
    const view: ComponentType<{ state: WalState }> = WalView;
    expect(view).toBe(WalView);
  });
});
