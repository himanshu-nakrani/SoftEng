import { buildAlgoSteps } from "@/engine/algo/build";
import { MVCC_COUNTERS as M } from "@/engine/algo/mvcc";
import type { VersionsState } from "@/engine/algo/views/versions";
import type { AlgoDef } from "@/engine/algo/types";
import {
  snapshotReadAlgo,
  writeConflictAlgo,
} from "@/lessons/mvcc/multi-version-reads";
import { describe, expect, it } from "vitest";

/**
 * The MVCC lesson states numbers. A failure here means the page now lies, and
 * the message should name the sentence that became untrue.
 *
 * Same contract as `transaction-claims.test.ts`: the anomaly is modelled, not
 * asserted, so the claim tests measure the model.
 */

function run<I>(def: AlgoDef<VersionsState, I>, seed: number) {
  const steps = buildAlgoSteps(def, 0, seed);
  const last = steps[steps.length - 1];
  return { steps, state: last.state, counters: last.counters };
}

const total = (state: VersionsState, id: string) =>
  Object.values(state.txns.find((t) => t.id === id)!.seen).reduce((a, b) => a + b, 0);

const committed = (state: VersionsState, row: string) => {
  const chain = state.rows.find((r) => r.key === row)!.versions.filter((v) => v.committed && !v.aborted);
  return chain[chain.length - 1].value;
};

describe("multi-version-reads: the report reads a consistent snapshot", () => {
  it("totals 200 in all 200 seeds, whatever the interleaving", () => {
    // "the report totals 200 in every run" — the promise repeatable read makes,
    // now shown as a choice of version.
    for (let seed = 0; seed < 200; seed++) {
      expect(total(run(snapshotReadAlgo, seed).state, "T1")).toBe(200);
    }
  });

  it("never blocks: both transactions commit in every run", () => {
    // "neither transaction ever waits for the other" — a reader is answered from
    // an old version, so a writer never has to hold it up.
    for (let seed = 0; seed < 200; seed++) {
      const { state } = run(snapshotReadAlgo, seed);
      expect(state.txns.every((t) => t.status === "committed")).toBe(true);
    }
  });

  it("keeps the old version beside the new one — two versions per row", () => {
    // "after the transfer commits, alice holds two versions: 100 and 50, side by
    // side." The structural claim the whole lesson rests on.
    const { state } = run(snapshotReadAlgo, 42);
    const alice = state.rows.find((r) => r.key === "alice")!;
    const bob = state.rows.find((r) => r.key === "bob")!;
    expect(alice.versions.map((v) => v.value)).toEqual([100, 50]);
    expect(bob.versions.map((v) => v.value)).toEqual([100, 150]);
    // Both versions are real, committed facts — the old one is not discarded.
    expect(alice.versions.every((v) => v.committed && !v.aborted)).toBe(true);
  });

  it("reads the older version on a run where the transfer commits mid-report", () => {
    // "Reshuffle to seed 1: the report takes its snapshot at clock 2, reads
    // alice 100 and bob 100, though a newer bob 150 already sits beside it."
    const { steps, state, counters } = run(snapshotReadAlgo, 1);
    expect(counters[M.snapshotReads]).toBeGreaterThan(0);
    const t1 = state.txns.find((t) => t.id === "T1")!;
    expect(t1.startTs).toBe(2);
    // The frame that reads the old version names it.
    const noteFrame = steps.find((s) => s.state.snapshotNote);
    expect(noteFrame?.state.snapshotNote).toContain("from its snapshot");
    // And the older version it read is not the newest committed one.
    const bob = state.rows.find((r) => r.key === "bob")!;
    expect(bob.versions.map((v) => v.value)).toEqual([100, 150]);
    expect(t1.seen.bob).toBe(100);
  });

  it("creates two versions — the storage cost of keeping the old ones", () => {
    // "the versions-kept meter reads 2: one new version per row the transfer
    // touched."
    expect(run(snapshotReadAlgo, 42).counters[M.versions]).toBe(2);
  });
});

describe("multi-version-reads: write-write conflict, first committer wins", () => {
  it("both commit in only 49 of 200 runs; the other 151 refuse one", () => {
    // "the deposit and the withdrawal both succeed in 49 of 200 orders. In the
    // other 151 one of them is refused." Same 49/151 split as the lost-update
    // lesson, which is the parallel the page draws.
    let both = 0;
    let refused = 0;
    for (let seed = 0; seed < 200; seed++) {
      const { state, counters } = run(writeConflictAlgo, seed);
      if (state.txns.every((t) => t.status === "committed")) both += 1;
      if ((counters[M.conflicts] ?? 0) > 0) refused += 1;
    }
    expect(both).toBe(49);
    expect(refused).toBe(151);
  });

  it("lands on 120 when both commit, and 150 or 70 when one is refused", () => {
    // "both succeed and the balance is 120; otherwise the winner's value stands,
    // 150 or 70 — never the silently-merged 120 a lost update would leave."
    for (let seed = 0; seed < 200; seed++) {
      const { state, counters } = run(writeConflictAlgo, seed);
      if ((counters[M.conflicts] ?? 0) > 0) {
        expect([70, 150]).toContain(committed(state, "balance"));
      } else {
        expect(committed(state, "balance")).toBe(120);
      }
    }
  });

  it("refuses rather than overwrites — one committed, one rolled back", () => {
    // "the loser is rolled back, not silently overwritten" — the difference from
    // the lost update, which reported success to both.
    let refusedRuns = 0;
    for (let seed = 0; seed < 200; seed++) {
      const { state, counters } = run(writeConflictAlgo, seed);
      if ((counters[M.conflicts] ?? 0) > 0) {
        refusedRuns += 1;
        expect(state.txns.filter((t) => t.status === "committed")).toHaveLength(1);
        expect(state.txns.filter((t) => t.status === "aborted")).toHaveLength(1);
        // The rolled-back version stays in the chain, struck through.
        expect(state.rows[0].versions.some((v) => v.aborted)).toBe(true);
      }
    }
    expect(refusedRuns).toBe(151);
  });

  it("keeps every version chain deterministic per seed", () => {
    expect(buildAlgoSteps(writeConflictAlgo, 0, 7)).toEqual(buildAlgoSteps(writeConflictAlgo, 0, 7));
  });
});
