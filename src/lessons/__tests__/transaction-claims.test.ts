import { buildAlgoSteps } from "@/engine/algo/build";
import { TXN_COUNTERS as T } from "@/engine/algo/transactions";
import type { TableState } from "@/engine/algo/views/table";
import type { AlgoDef } from "@/engine/algo/types";
import { describe, expect, it } from "vitest";

import {
  dirtyReadAlgo,
  readCommittedAlgo,
} from "@/lessons/transactions/dirty-reads";
import {
  nonRepeatableAlgo,
  repeatableReadAlgo,
} from "@/lessons/transactions/non-repeatable-reads";
import {
  serializableAlgo,
  writeSkewAlgo,
} from "@/lessons/transactions/write-skew";
import {
  lostUpdateAlgo,
  lostUpdateSerializableAlgo,
} from "@/lessons/transactions/lost-update";
import {
  optimisticAlgo,
  twoPhaseLockingAlgo,
} from "@/lessons/transactions/two-phase-locking";

/**
 * Track 03's prose states numbers too — "roughly one run in three", "over forty
 * per cent", "200 every time". Same contract as
 * `concurrency-claims.test.ts`: a failure here means a lesson page now lies.
 */

function run<I>(def: AlgoDef<TableState, I>, seed: number, reporterId = "T2") {
  const steps = buildAlgoSteps(def, 0, seed);
  const last = steps[steps.length - 1];
  const reporter = last.state.txns.find((t) => t.id === reporterId)!;
  return {
    steps,
    state: last.state,
    dirtyReads: last.counters[T.dirtyReads] ?? 0,
    reported: (reporter.seen.alice ?? 0) + (reporter.seen.bob ?? 0),
  };
}

describe("dirty-reads: the anomaly is real, and read committed removes it", () => {
  it("reads uncommitted data in over 40% of runs", () => {
    let dirty = 0;
    for (let seed = 0; seed < 200; seed++) {
      if (run(dirtyReadAlgo, seed).dirtyReads > 0) dirty += 1;
    }
    expect(dirty / 200).toBeGreaterThan(0.35);
    expect(dirty / 200).toBeLessThan(0.55);
  });

  it("reports a total that was never committed in roughly one run in three", () => {
    const totals = new Map<number, number>();
    for (let seed = 0; seed < 200; seed++) {
      const total = run(dirtyReadAlgo, seed).reported;
      totals.set(total, (totals.get(total) ?? 0) + 1);
    }
    // The page names 150 and 250 specifically.
    expect(totals.get(150) ?? 0).toBeGreaterThan(0);
    expect(totals.get(250) ?? 0).toBeGreaterThan(0);
    const wrong = (totals.get(150) ?? 0) + (totals.get(250) ?? 0);
    expect(wrong / 200).toBeGreaterThan(0.2);
    expect(wrong / 200).toBeLessThan(0.45);
  });

  it("hides itself when both dirty values are read — the total looks right", () => {
    // The page claims dirty reads outnumber visibly-wrong totals, which is why
    // the bug survives testing. That ordering is the claim being pinned.
    let dirty = 0;
    let wrong = 0;
    for (let seed = 0; seed < 200; seed++) {
      const r = run(dirtyReadAlgo, seed);
      if (r.dirtyReads > 0) dirty += 1;
      if (r.reported !== 200) wrong += 1;
    }
    expect(dirty).toBeGreaterThan(wrong);
  });

  it("never reads uncommitted data at read committed — 0 of 200 seeds", () => {
    for (let seed = 0; seed < 200; seed++) {
      const r = run(readCommittedAlgo, seed);
      expect(r.dirtyReads).toBe(0);
      expect(r.reported).toBe(200);
      expect(r.state.anomaly).toBeUndefined();
    }
  });

  it("always leaves the table consistent — the rollback works either way", () => {
    for (const def of [dirtyReadAlgo, readCommittedAlgo]) {
      for (let seed = 0; seed < 60; seed++) {
        const { state } = run(def, seed);
        const alice = state.rows.find((r) => r.key === "alice")!;
        const bob = state.rows.find((r) => r.key === "bob")!;
        expect(alice.committed).toBe(100);
        expect(bob.committed).toBe(100);
        // Nothing may be left pending once every transaction has finished.
        for (const row of state.rows) {
          expect(Object.keys(row.pending)).toHaveLength(0);
        }
      }
    }
  });

  it("never aliases a frame, so step-back shows the table as it was", () => {
    const { steps } = run(dirtyReadAlgo, 3);
    expect(new Set(steps.map((s) => s.state)).size).toBe(steps.length);
    expect(new Set(steps.map((s) => s.state.rows)).size).toBe(steps.length);
    expect(steps[0].state.active).toBeNull();
  });

  it("is deterministic per seed", () => {
    expect(buildAlgoSteps(dirtyReadAlgo, 0, 7)).toEqual(
      buildAlgoSteps(dirtyReadAlgo, 0, 7),
    );
  });
});

describe("non-repeatable-reads: legal reads, wrong total, fixed by a snapshot", () => {
  it("reports 250 in roughly one run in four, with no dirty read", () => {
    let wrong = 0;
    for (let seed = 0; seed < 200; seed++) {
      const r = run(nonRepeatableAlgo, seed, "T1");
      // The whole point: nothing uncommitted was ever read.
      expect(r.dirtyReads).toBe(0);
      expect([200, 250]).toContain(r.reported);
      if (r.reported === 250) wrong += 1;
    }
    expect(wrong / 200).toBeGreaterThan(0.12);
    expect(wrong / 200).toBeLessThan(0.4);
  });

  it("always reports 200 at repeatable read — 200 of 200 seeds", () => {
    for (let seed = 0; seed < 200; seed++) {
      const r = run(repeatableReadAlgo, seed, "T1");
      expect(r.reported).toBe(200);
      expect(r.dirtyReads).toBe(0);
    }
  });

  it("does not delay the writer to protect the reader", () => {
    // A snapshot is not a lock: T2 must still commit in every run.
    for (let seed = 0; seed < 60; seed++) {
      const { state } = run(repeatableReadAlgo, seed, "T1");
      const writer = state.txns.find((t) => t.id === "T2")!;
      expect(writer.status).toBe("committed");
    }
  });

  it("leaves the transfer correct either way", () => {
    for (const def of [nonRepeatableAlgo, repeatableReadAlgo]) {
      for (let seed = 0; seed < 60; seed++) {
        const { state } = run(def, seed, "T1");
        const alice = state.rows.find((r) => r.key === "alice")!.committed;
        const bob = state.rows.find((r) => r.key === "bob")!.committed;
        // The page names these values, not just their sum. Asserting only the
        // sum let the prose say "alice 100, bob 100" while the run ended at
        // 50/150 — a sentence a passing test did not contradict.
        expect(alice).toBe(50);
        expect(bob).toBe(150);
        expect(alice + bob).toBe(200);
      }
    }
  });
});

describe("write-skew: the anomaly a snapshot cannot fix", () => {
  const onCall = (def: typeof writeSkewAlgo, seed: number) => {
    const steps = buildAlgoSteps(def, 0, seed);
    const last = steps[steps.length - 1];
    const value = (key: string) =>
      last.state.rows.find((r) => r.key === key)!.committed;
    return {
      total: value("alice_oncall") + value("bob_oncall"),
      refused: last.counters[T.conflicts] ?? 0,
    };
  };

  it("leaves nobody on call in roughly three runs in four", () => {
    let broken = 0;
    for (let seed = 0; seed < 200; seed++) {
      if (onCall(writeSkewAlgo, seed).total === 0) broken += 1;
    }
    expect(broken / 200).toBeGreaterThan(0.6);
    expect(broken / 200).toBeLessThan(0.9);
  });

  it("never refuses a commit at repeatable read — it cannot see the conflict", () => {
    for (let seed = 0; seed < 200; seed++) {
      expect(onCall(writeSkewAlgo, seed).refused).toBe(0);
    }
  });

  it("holds the invariant at serializable, in all 200 seeds", () => {
    for (let seed = 0; seed < 200; seed++) {
      // At least one doctor on call, always.
      expect(onCall(serializableAlgo, seed).total).toBeGreaterThanOrEqual(1);
    }
  });

  it("refuses EXACTLY the runs that would have broken the invariant", () => {
    /*
     * The page states this correspondence as exact — never more, never fewer —
     * which is a much stronger claim than "serializable is safer", and the only
     * one of these numbers that would be embarrassing to get wrong.
     */
    const broken = new Set<number>();
    const refused = new Set<number>();
    for (let seed = 0; seed < 200; seed++) {
      if (onCall(writeSkewAlgo, seed).total === 0) broken.add(seed);
      if (onCall(serializableAlgo, seed).refused > 0) refused.add(seed);
    }
    expect([...broken].filter((s) => !refused.has(s))).toEqual([]);
    expect([...refused].filter((s) => !broken.has(s))).toEqual([]);
    expect(refused.size).toBe(151);
  });
});

describe("lost-update: silently wrong, versus visibly refused", () => {
  const balance = (def: typeof lostUpdateAlgo, seed: number) => {
    const steps = buildAlgoSteps(def, 0, seed);
    const last = steps[steps.length - 1];
    return {
      value: last.state.rows.find((r) => r.key === "balance")!.committed,
      refused: last.counters[T.conflicts] ?? 0,
      txns: last.state.txns,
    };
  };

  it("lands on 150, 70 or 120 — and 120 only about a quarter of the time", () => {
    const seen = new Map<number, number>();
    for (let seed = 0; seed < 200; seed++) {
      const v = balance(lostUpdateAlgo, seed).value;
      seen.set(v, (seen.get(v) ?? 0) + 1);
    }
    expect([...seen.keys()].sort((a, b) => a - b)).toEqual([70, 120, 150]);
    const correct = seen.get(120) ?? 0;
    expect(correct / 200).toBeGreaterThan(0.15);
    expect(correct / 200).toBeLessThan(0.35);
  });

  it("reports no error when it loses one — that is the whole problem", () => {
    for (let seed = 0; seed < 200; seed++) {
      const r = balance(lostUpdateAlgo, seed);
      expect(r.refused).toBe(0);
      // Both transactions succeeded, whatever the balance says.
      expect(r.txns.every((t) => t.status === "committed")).toBe(true);
    }
  });

  it("does NOT reach 120 at serializable either — it refuses instead", () => {
    /*
     * The page is explicit that serializable relocates the problem rather than
     * solving it, because a refused transaction never committed. Asserting the
     * balance is still 150 or 70 keeps the prose from drifting back to the
     * comfortable-but-wrong "serializable fixes it".
     */
    let refusedRuns = 0;
    for (let seed = 0; seed < 200; seed++) {
      const r = balance(lostUpdateSerializableAlgo, seed);
      if (r.refused > 0) {
        refusedRuns += 1;
        expect([70, 150]).toContain(r.value);
        expect(r.txns.filter((t) => t.status === "committed")).toHaveLength(1);
        expect(r.txns.filter((t) => t.status === "aborted")).toHaveLength(1);
      } else {
        expect(r.value).toBe(120);
      }
    }
    expect(refusedRuns).toBe(151);
  });

  it("refuses exactly the runs that lost an update", () => {
    const lost = new Set<number>();
    const refused = new Set<number>();
    for (let seed = 0; seed < 200; seed++) {
      if (balance(lostUpdateAlgo, seed).value !== 120) lost.add(seed);
      if (balance(lostUpdateSerializableAlgo, seed).refused > 0) refused.add(seed);
    }
    expect([...lost].filter((s) => !refused.has(s))).toEqual([]);
    expect([...refused].filter((s) => !lost.has(s))).toEqual([]);
  });
});

describe("two-phase-locking: same guarantee, opposite failure mode", () => {
  const summarise = (def: typeof optimisticAlgo, seed: number) => {
    const steps = buildAlgoSteps(def, 0, seed);
    const last = steps[steps.length - 1];
    return {
      balance: last.state.rows.find((r) => r.key === "balance")!.committed,
      refused: last.counters[T.conflicts] ?? 0,
      bothCommitted: last.state.txns.every((t) => t.status === "committed"),
      everWaited: steps.some((st) => st.state.txns.some((t) => t.waitingOn)),
      everLocked: steps.some((st) => st.state.rows.some((r) => r.lockedBy)),
    };
  };

  it("optimistic: both commit in only 49 of 200 runs, and nobody waits", () => {
    let both = 0;
    for (let seed = 0; seed < 200; seed++) {
      const r = summarise(optimisticAlgo, seed);
      if (r.bothCommitted) both += 1;
      expect(r.everWaited).toBe(false);
    }
    expect(both).toBe(49);
  });

  it("2PL: both commit in all 200 runs, and the balance is always 120", () => {
    for (let seed = 0; seed < 200; seed++) {
      const r = summarise(twoPhaseLockingAlgo, seed);
      expect(r.bothCommitted).toBe(true);
      expect(r.balance).toBe(120);
      expect(r.refused).toBe(0);
    }
  });

  it("2PL: something waits in every run, and the row is visibly locked", () => {
    // The page states both of these as universal, and they are the cost side of
    // the trade — the reason 2PL is not simply better.
    for (let seed = 0; seed < 200; seed++) {
      const r = summarise(twoPhaseLockingAlgo, seed);
      expect(r.everWaited).toBe(true);
      expect(r.everLocked).toBe(true);
    }
  });

  it("holds the lock from the read until the commit, not just for the write", () => {
    const steps = buildAlgoSteps(twoPhaseLockingAlgo, 0, 42);
    // Find the first frame where a lock exists, and confirm the holder had only
    // read at that point — taking it at the write would be too late.
    const firstLocked = steps.findIndex((st) =>
      st.state.rows.some((r) => r.lockedBy),
    );
    expect(firstLocked).toBeGreaterThan(0);
    expect(steps[firstLocked].state.ranStatement).toBe("read balance");
  });
});
