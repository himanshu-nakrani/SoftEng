import { MVCC_COUNTERS, runMvcc, type MvccProgram } from "@/engine/algo/mvcc";
import type { AlgoDef } from "@/engine/algo/types";
import type { VersionsState } from "@/engine/algo/views/versions";

/**
 * Multi-Version Reads — archetype B (`engine: "steps"`).
 *
 * The non-repeatable-reads lesson ended by naming MVCC: a snapshot stays
 * readable "because the database keeps several versions of a row." That lesson
 * showed the OUTCOME — a stable total — with the versions hidden inside a single
 * committed cell. This lesson opens that cell.
 *
 * A row here is a CHAIN of versions, each stamped with the transaction that
 * wrote it and the logical time it committed. A reading transaction takes a
 * snapshot timestamp when it begins and reads the newest version committed at or
 * before that time. So a writer can commit a new version while a reader is still
 * looking at the old one, and neither waits for the other — the old version is
 * still physically there to read. That is the whole trick, and it is why "the
 * reader looks at an older world" is a description of storage, not a metaphor.
 *
 * MODELLING NOTE, and its limits. This is SNAPSHOT ISOLATION, the guarantee
 * repeatable read gives. Two things are modelled and one is deliberately not:
 *
 *   - MODELLED: snapshot reads. A version committed after a reader's snapshot is
 *     invisible to it, so `runMvcc` never blocks a read and the reader's total
 *     is always internally consistent.
 *   - MODELLED: first-committer-wins. Two transactions that write the same row
 *     conflict at commit time; the second to try is refused and rolled back.
 *     That is what a lost update becomes under MVCC — a visible abort rather
 *     than a silent overwrite.
 *   - NOT MODELLED: serializability. Write skew survives snapshot isolation,
 *     exactly as the write-skew lesson teaches, because two transactions writing
 *     DIFFERENT rows have no write-write conflict to catch. MVCC is not a
 *     stronger promise than repeatable read; it is a cheaper way to keep the
 *     same one. Version garbage collection is also absent — a real engine
 *     vacuums versions no snapshot can still see, which changes storage cost,
 *     not the visibility rule that is the argument here.
 */

const READ_CODE = ["read alice", "read bob", "report total", "COMMIT"];

/**
 * A reporter reads two rows; a transfer moves money between them. The reporter's
 * snapshot keeps its two reads consistent even when the transfer commits between
 * them — the non-repeatable read the previous lesson diagnosed, now shown as a
 * choice of version rather than a copied snapshot.
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
          { label: "report total", codeLine: 2 },
          { label: "COMMIT", codeLine: 3, commit: true },
        ],
      },
      {
        id: "T2",
        name: "T2 · transfer",
        statements: [
          { label: "read alice", run: (c) => { c.read("alice"); } },
          {
            label: "alice -= 50",
            run: (c) => {
              c.write("alice", (c.seen.alice ?? 100) - 50);
            },
          },
          {
            label: "bob += 50",
            run: (c) => {
              c.write("bob", (c.seen.bob ?? 100) + 50);
            },
          },
          { label: "COMMIT", commit: true },
        ],
      },
    ],
  };
}

const CONFLICT_CODE = ["read balance", "balance += d", "COMMIT"];

/**
 * Two transactions both read the balance and both write it back. Under snapshot
 * isolation the first to commit wins; the second is refused because the row it
 * based its write on has changed since its snapshot. Same program, same seeds as
 * the lost-update lesson's — the lost update reappears as a first-committer-wins
 * abort, which is MVCC's honest answer to it.
 */
function conflictProgram(): MvccProgram {
  const account = (id: string, name: string, delta: number) => ({
    id,
    name,
    statements: [
      {
        label: "read balance",
        codeLine: 0,
        run: (c: { read: (r: string) => number }) => {
          c.read("balance");
        },
      },
      {
        label: delta >= 0 ? `balance += ${delta}` : `balance -= ${-delta}`,
        codeLine: 1,
        run: (c: { seen: Record<string, number>; write: (r: string, v: number) => void }) => {
          c.write("balance", (c.seen.balance ?? 0) + delta);
        },
      },
      { label: "COMMIT", codeLine: 2, commit: true },
    ],
  });

  return {
    rows: { balance: 100 },
    txns: [account("T1", "T1 · deposit 50", 50), account("T2", "T2 · withdraw 30", -30)],
  };
}

const readCounters = [
  { key: MVCC_COUNTERS.statements, label: "statements" },
  { key: MVCC_COUNTERS.versions, label: "versions kept" },
  { key: MVCC_COUNTERS.snapshotReads, label: "snapshot reads" },
];

const conflictCounters = [
  { key: MVCC_COUNTERS.statements, label: "statements" },
  { key: MVCC_COUNTERS.versions, label: "versions kept" },
  { key: MVCC_COUNTERS.conflicts, label: "commits refused" },
];

/** Readers never block writers: the report reads its own consistent snapshot. */
export const snapshotReadAlgo: AlgoDef<VersionsState, MvccProgram> = {
  id: "multi-version-reads",
  title: "snapshot isolation",
  code: READ_CODE,
  counters: readCounters,
  generateInput: () => reportProgram(),
  run: (input, rng) => runMvcc(input, rng),
};

/** First-committer-wins: two writers of one row, one of them refused. */
export const writeConflictAlgo: AlgoDef<VersionsState, MvccProgram> = {
  id: "multi-version-reads-conflict",
  title: "first committer wins",
  code: CONFLICT_CODE,
  counters: conflictCounters,
  generateInput: () => conflictProgram(),
  run: (input, rng) => runMvcc(input, rng),
};
