import { buildAlgoSteps } from "@/engine/algo/build";
import { MVCC_COUNTERS, runMvcc, type MvccProgram } from "@/engine/algo/mvcc";
import type { AlgoDef } from "@/engine/algo/types";
import type { VersionsState } from "@/engine/algo/views/versions";
import { VersionsView } from "@/engine/algo/views/VersionsView";
import type { ComponentType } from "react";
import { describe, expect, it } from "vitest";

/**
 * The report program: T1 reads two rows and totals them; T2 transfers between
 * them. Under snapshot isolation T1 always reads a consistent pair, even when T2
 * commits between its reads.
 */
function reportProgram(): MvccProgram {
  return {
    rows: { alice: 100, bob: 100 },
    txns: [
      {
        id: "T1",
        name: "T1 · report",
        statements: [
          { label: "read alice", codeLine: 0, run: (c) => { c.read("alice"); } },
          { label: "read bob", codeLine: 1, run: (c) => { c.read("bob"); } },
          { label: "report", codeLine: 2 },
          { label: "COMMIT", codeLine: 3, commit: true },
        ],
      },
      {
        id: "T2",
        name: "T2 · transfer",
        statements: [
          { label: "read alice", run: (c) => { c.read("alice"); } },
          { label: "alice -= 50", run: (c) => { c.write("alice", (c.seen.alice ?? 100) - 50); } },
          { label: "bob += 50", run: (c) => { c.write("bob", (c.seen.bob ?? 100) + 50); } },
          { label: "COMMIT", commit: true },
        ],
      },
    ],
  };
}

/** Two writers of one balance — a lost update, as a first-committer-wins abort. */
function conflictProgram(): MvccProgram {
  const account = (id: string, name: string, delta: number) => ({
    id,
    name,
    statements: [
      { label: "read", codeLine: 0, run: (c: { read: (r: string) => number }) => { c.read("balance"); } },
      {
        label: "write",
        codeLine: 1,
        run: (c: { seen: Record<string, number>; write: (r: string, v: number) => void }) => {
          c.write("balance", (c.seen.balance ?? 0) + delta);
        },
      },
      { label: "COMMIT", codeLine: 2, commit: true },
    ],
  });
  return { rows: { balance: 100 }, txns: [account("T1", "T1", 50), account("T2", "T2", -30)] };
}

const last = (steps: { state: VersionsState; counters: Record<string, number> }[]) =>
  steps[steps.length - 1];
const total = (state: VersionsState, id: string) => {
  const t = state.txns.find((x) => x.id === id)!;
  return Object.values(t.seen).reduce((a, b) => a + b, 0);
};
const committedValue = (state: VersionsState, row: string) => {
  const chain = state.rows.find((r) => r.key === row)!.versions.filter((v) => v.committed && !v.aborted);
  return chain[chain.length - 1].value;
};

describe("runMvcc", () => {
  it("is deterministic per seed and starts from the untouched input", () => {
    const rng = () => 0.5;
    expect(runMvcc(reportProgram(), rng)).toEqual(runMvcc(reportProgram(), rng));

    const first = runMvcc(reportProgram(), () => 0.5)[0].state;
    // Every row opens with exactly ONE committed base version at time 0.
    for (const row of first.rows) {
      expect(row.versions).toHaveLength(1);
      expect(row.versions[0]).toMatchObject({ committed: true, commitTs: 0, createdBy: "init" });
    }
    expect(first.active).toBeNull();
    expect(first.clock).toBe(0);
    expect(first.txns.every((t) => t.status === "idle" && t.startTs === undefined)).toBe(true);
  });

  it("never aliases a frame, so stepping back shows the chains as they were", () => {
    const steps = runMvcc(reportProgram(), mulberryish(42));
    expect(new Set(steps.map((s) => s.state)).size).toBe(steps.length);
    expect(new Set(steps.map((s) => s.state.rows)).size).toBe(steps.length);
    // A version's `committed`/`commitTs` flip as the run proceeds; a shared
    // reference would make the first frame already show every version committed.
    expect(steps[1].state.rows.every((r) => r.versions.length >= 1)).toBe(true);
    const anyPending = steps.some((s) =>
      s.state.rows.some((r) => r.versions.some((v) => !v.committed && !v.aborted)),
    );
    expect(anyPending).toBe(true);
  });

  it("keeps counters monotonic and code lines in range", () => {
    for (let seed = 0; seed < 40; seed++) {
      for (const program of [reportProgram, conflictProgram]) {
        const steps = runMvcc(program(), mulberryish(seed));
        const totals: Record<string, number> = {};
        for (const step of steps) {
          for (const [key, value] of Object.entries(step.counters)) {
            expect(value).toBeGreaterThanOrEqual(totals[key] ?? 0);
            totals[key] = value;
          }
          if (step.codeLine !== undefined) {
            expect(step.codeLine).toBeGreaterThanOrEqual(0);
            expect(step.codeLine).toBeLessThan(4);
          }
        }
      }
    }
  });

  it("counts a new version on every write", () => {
    // The storage cost has to be visible in a counter, not just the prose.
    const steps = runMvcc(reportProgram(), mulberryish(42));
    // T2 writes two rows, so exactly two versions are created.
    expect(last(steps).counters[MVCC_COUNTERS.versions]).toBe(2);
  });

  it("runs a non-report state shape too", () => {
    // A single-row program exercises the chain code without two rows to lean on.
    const steps = runMvcc(conflictProgram(), mulberryish(7));
    expect(steps[0].state.rows).toHaveLength(1);
    expect(last(steps).state.rows[0].versions.length).toBeGreaterThan(1);
  });
});

/**
 * The distribution tests drive `buildAlgoSteps` with the REAL seeded RNG, so
 * their counts match the lesson claim tests (which do the same). The direct
 * `runMvcc` tests above only need reproducible variety, so they use a local rng.
 */
const reportDef: AlgoDef<VersionsState, MvccProgram> = {
  id: "multi-version-reads",
  title: "snapshot isolation",
  code: ["read alice", "read bob", "report total", "COMMIT"],
  counters: [
    { key: MVCC_COUNTERS.statements, label: "statements" },
    { key: MVCC_COUNTERS.versions, label: "versions kept" },
    { key: MVCC_COUNTERS.snapshotReads, label: "snapshot reads" },
  ],
  generateInput: () => reportProgram(),
  run: (input, rng) => runMvcc(input, rng),
};
const conflictDef: AlgoDef<VersionsState, MvccProgram> = {
  id: "multi-version-reads-conflict",
  title: "first committer wins",
  code: ["read", "write", "COMMIT"],
  counters: [
    { key: MVCC_COUNTERS.statements, label: "statements" },
    { key: MVCC_COUNTERS.conflicts, label: "commits refused" },
  ],
  generateInput: () => conflictProgram(),
  run: (input, rng) => runMvcc(input, rng),
};

describe("snapshot reads — readers never block writers", () => {
  it("keeps the report's total consistent across every seed", () => {
    // The whole point: the two reads see one consistent world, so the total is
    // always 200 no matter how the transfer interleaves.
    for (let seed = 0; seed < 200; seed++) {
      const state = last(buildAlgoSteps(reportDef, 0, seed)).state;
      // T1 always commits — a snapshot read is never refused.
      expect(state.txns.find((t) => t.id === "T1")!.status).toBe("committed");
      expect(total(state, "T1")).toBe(200);
    }
  });

  it("lets the transfer commit while the report is mid-read, both succeeding", () => {
    // No blocking: in every run both transactions commit.
    for (let seed = 0; seed < 60; seed++) {
      const state = last(buildAlgoSteps(reportDef, 0, seed)).state;
      expect(state.txns.every((t) => t.status === "committed")).toBe(true);
    }
  });

  it("reads an OLD version when a newer one committed after its snapshot", () => {
    // Seed 1 interleaves so T1's snapshot predates T2's commit. The version T1
    // reads is committed and older than the newest committed version.
    const steps = buildAlgoSteps(reportDef, 0, 1);
    const snapFrame = steps.find((s) => s.state.snapshotNote);
    expect(snapFrame).toBeDefined();
    expect(snapFrame!.counters[MVCC_COUNTERS.snapshotReads]).toBeGreaterThan(0);
    // And it still totalled 200 — the point of the older version being kept.
    expect(total(last(steps).state, "T1")).toBe(200);
  });

  it("keeps both versions of a row side by side, not one replacing the other", () => {
    // The structural claim MVCC rests on: after the transfer commits, the row
    // has TWO versions, the old one still present.
    const alice = last(buildAlgoSteps(reportDef, 0, 42)).state.rows.find((r) => r.key === "alice")!;
    expect(alice.versions.length).toBe(2);
    expect(alice.versions[0]).toMatchObject({ value: 100, committed: true });
    expect(alice.versions[1]).toMatchObject({ value: 50, committed: true });
  });
});

describe("write-write conflict — first committer wins", () => {
  it("refuses exactly the runs that would have lost an update", () => {
    // 49 of 200 interleavings let both commit (T1 and T2 do not overlap on the
    // balance); the other 151 refuse one. This matches the lost-update lesson's
    // split, which is the parallel the prose draws.
    let both = 0;
    let refused = 0;
    for (let seed = 0; seed < 200; seed++) {
      const steps = buildAlgoSteps(conflictDef, 0, seed);
      const s = last(steps).state;
      if (s.txns.every((t) => t.status === "committed")) both += 1;
      if ((last(steps).counters[MVCC_COUNTERS.conflicts] ?? 0) > 0) refused += 1;
    }
    expect(both).toBe(49);
    expect(refused).toBe(151);
    expect(both + refused).toBe(200);
  });

  it("never silently overwrites — a refused write is aborted, not applied", () => {
    for (let seed = 0; seed < 200; seed++) {
      const steps = buildAlgoSteps(conflictDef, 0, seed);
      const s = last(steps).state;
      const conflicts = last(steps).counters[MVCC_COUNTERS.conflicts] ?? 0;
      if (conflicts > 0) {
        // Exactly one committed, one aborted, and the aborted version is dead.
        expect(s.txns.filter((t) => t.status === "committed")).toHaveLength(1);
        expect(s.txns.filter((t) => t.status === "aborted")).toHaveLength(1);
        // When one is refused the balance is 150 or 70 — the winner's write, not
        // the arithmetic sum 120 a serialized run would give.
        expect([70, 150]).toContain(committedValue(s, "balance"));
      } else {
        // Both committed only when they did not overlap; balance is 120.
        expect(committedValue(s, "balance")).toBe(120);
      }
    }
  });

  it("marks the loser's version aborted rather than removing it", () => {
    // The red struck-through version IS the teaching object, so it must remain
    // in the chain.
    const aborted = last(buildAlgoSteps(conflictDef, 0, 42)).state.rows[0].versions.filter(
      (v) => v.aborted,
    );
    expect(aborted).toHaveLength(1);
  });
});

describe("multi-version-reads rides on archetype B", () => {
  const def: AlgoDef<VersionsState, MvccProgram> = {
    id: "multi-version-reads",
    title: "snapshot isolation",
    code: ["read alice", "read bob", "report total", "COMMIT"],
    counters: [
      { key: MVCC_COUNTERS.statements, label: "statements" },
      { key: MVCC_COUNTERS.versions, label: "versions kept" },
      { key: MVCC_COUNTERS.snapshotReads, label: "snapshot reads" },
    ],
    generateInput: () => reportProgram(),
    run: (input, rng) => runMvcc(input, rng),
  };

  it("runs through buildAlgoSteps, reproducibly per seed", () => {
    expect(buildAlgoSteps(def, 0, 42)).toEqual(buildAlgoSteps(def, 0, 42));
  });

  it("explores different interleavings across seeds", () => {
    // The scheduler is seeded, so reseeding must reach more than one order.
    const shapes = new Set<string>();
    for (let seed = 0; seed < 40; seed++) {
      const steps = buildAlgoSteps(def, 0, seed);
      shapes.add(steps.map((s) => s.state.active ?? "-").join(","));
    }
    expect(shapes.size).toBeGreaterThan(3);
  });

  it("has a fixed input, so both ends of any size argument agree", () => {
    // This def takes no size control; the size argument must not change the run.
    expect(buildAlgoSteps(def, 0, 42)).toEqual(buildAlgoSteps(def, 12, 42));
  });

  it("satisfies the view contract the figure requires", () => {
    const view: ComponentType<{ state: VersionsState }> = VersionsView;
    expect(view).toBe(VersionsView);
  });
});

/**
 * A cheap deterministic pseudo-RNG for the tests — the same shape `mulberry32`
 * has (0..1), seeded so a run replays. `buildAlgoSteps` uses the real one; these
 * unit tests drive `runMvcc` directly and only need reproducible variety.
 */
function mulberryish(seed: number): () => number {
  let a = seed + 0x6d2b79f5;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
