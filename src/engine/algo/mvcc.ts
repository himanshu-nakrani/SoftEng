import { StepRecorder } from "./recorder";
import type { AlgoStep } from "./types";
import type {
  MvccRowFrame,
  MvccTxnFrame,
  MvccTxnStatus,
  VersionFrame,
  VersionsState,
} from "./views/versions";

/**
 * MVCC — a step producer for archetype B, over `VersionsState`.
 *
 * The sixth thing to ride the discrete-step engine, and the one that OPENS the
 * black box the isolation lessons stand on. `transactions.ts` answers a
 * repeatable-read read from `rt.snapshot`, a copy of the committed values taken
 * when a transaction began — a correct model of the OUTCOME, but silent about
 * the machinery. This producer replaces that single cell with a version CHAIN:
 * a row is a list of versions, each stamped with who wrote it and when it
 * committed, and a read walks the chain for the newest version a reader's
 * snapshot can see. That is what multi-version concurrency control literally is,
 * and it is why "the reader looks at an older world" stops being a metaphor.
 *
 * WHY NOT EXTEND `transactions.ts`. Five shipped lessons depend on
 * `runTransactions`, `visibleTo` and the committed/pending split. MVCC needs a
 * different state shape (chains, not one committed value) and a different read
 * rule (timestamp visibility, not level dispatch), so bending the shared
 * producer to carry it would put those five lessons one edit away from a silent
 * regression. A separate producer keeps them untouched by construction.
 *
 * WHAT IS MODELLED, AND WHAT IS NOT. This is SNAPSHOT ISOLATION — the guarantee
 * "repeatable read" gives in the isolation module, now shown mechanically:
 *
 *   - A transaction takes a `startTs` snapshot at its FIRST statement. It reads
 *     the newest version whose `commitTs <= startTs`, plus its own uncommitted
 *     writes. So a version committed after it began is invisible to it, and a
 *     writer never blocks a reader — the old version is still there to read.
 *   - A write appends a new, uncommitted version. First-committer-wins: if
 *     another transaction has committed a newer version of a row this one wrote
 *     since its snapshot, the commit is REFUSED and the transaction aborts. That
 *     is the write-write conflict a lost update becomes under MVCC.
 *
 * Deliberately NOT modelled: serializability. Write skew survives snapshot
 * isolation — two transactions writing DIFFERENT rows have no write-write
 * conflict to detect — exactly as the write-skew lesson already teaches. Garbage
 * collection of dead versions is also absent: real engines vacuum versions no
 * snapshot can still see, which changes storage cost, not the visibility rule
 * that is the whole argument here. This producer keeps every version so the
 * chain stays legible.
 */

/** One statement of a transaction, over an MVCC context. */
export interface MvccStatement {
  label: string;
  codeLine?: number;
  /** Returning "abort" rolls the transaction back. */
  run?: (ctx: MvccContext) => void | "abort";
  /** Marks the commit point; the transaction's versions become durable. */
  commit?: boolean;
}

export interface MvccContext {
  /** Read a row at this transaction's snapshot (plus its own writes). */
  read: (row: string) => number;
  /** Append a new uncommitted version of a row. */
  write: (row: string, value: number) => void;
  /** What this transaction has read so far, for display. */
  seen: Record<string, number>;
}

export interface MvccTxn {
  id: string;
  name: string;
  statements: MvccStatement[];
}

export interface MvccProgram {
  /** Initial committed values, keyed by row. Each becomes version 0. */
  rows: Record<string, number>;
  txns: MvccTxn[];
}

export const MVCC_COUNTERS = {
  /** Statements executed. */
  statements: "statements",
  /** Versions created — the storage cost of keeping the old ones. */
  versions: "versions",
  /**
   * Reads answered by an OLD version because a newer committed one is invisible
   * to the reader's snapshot. This is the mechanism, counted.
   */
  snapshotReads: "snapshotReads",
  /**
   * Commits refused because another transaction committed a conflicting version
   * first — the write-write conflict MVCC detects at commit time.
   */
  conflicts: "conflicts",
} as const;

/** A stored version, richer than the frame the view draws. */
interface Version {
  row: string;
  value: number;
  createdBy: string;
  beginTs: number;
  commitTs?: number;
  committed: boolean;
  aborted: boolean;
}

interface Runtime {
  txn: MvccTxn;
  pc: number;
  status: MvccTxnStatus;
  seen: Record<string, number>;
  /** Snapshot timestamp, taken at the first statement. Null until then. */
  startTs: number | null;
  /** Rows this transaction has written, for the commit-time conflict check. */
  written: Set<string>;
}

/**
 * Run the program, one frame per statement, choosing among unfinished
 * transactions with `rng`. Like `runTransactions`, the interleaving is the
 * lesson: a single seed replays one order, reseeding explores the legal others.
 */
export function runMvcc(
  program: MvccProgram,
  rng: () => number,
): AlgoStep<VersionsState>[] {
  const rowKeys = Object.keys(program.rows);

  // A logical clock. Ticks on every snapshot taken and every commit, so a
  // reader's startTs can be compared against a writer's commitTs.
  let clock = 0;

  // Version 0 of every row is committed at time 0 — the world before anyone ran.
  const versions: Version[] = rowKeys.map((row) => ({
    row,
    value: program.rows[row],
    createdBy: "init",
    beginTs: 0,
    commitTs: 0,
    committed: true,
    aborted: false,
  }));

  const runtimes: Runtime[] = program.txns.map((txn) => ({
    txn,
    pc: 0,
    status: "idle",
    seen: {},
    startTs: null,
    written: new Set<string>(),
  }));

  let active: string | null = null;
  let ranStatement: string | undefined;
  let snapshotNote: string | undefined;
  let conflict: string | undefined;
  /** Row + version the current statement touched, for the "active" flag. */
  let activeRow: string | undefined;
  let activeBeginTs: number | undefined;
  /** Row + version a read chose this frame, for the "readNow" flag. */
  let readRow: string | undefined;
  let readBeginTs: number | undefined;

  /**
   * The visibility rule, and the only place it lives.
   *
   * A transaction sees the newest version of a row that is EITHER its own
   * uncommitted write OR committed at or before its snapshot. A version
   * committed after `startTs` is invisible — that is the snapshot, made of
   * physical versions rather than a copied cell.
   */
  const visibleTo = (rt: Runtime, row: string): Version => {
    const chain = versions
      .filter((v) => v.row === row && !v.aborted)
      .sort((a, b) => a.beginTs - b.beginTs);
    let chosen = chain[0];
    for (const v of chain) {
      if (v.createdBy === rt.txn.id && !v.committed) {
        chosen = v; // its own pending write always wins
        continue;
      }
      if (v.committed && v.commitTs !== undefined && v.commitTs <= (rt.startTs ?? 0)) {
        chosen = v;
      }
    }
    return chosen;
  };

  /** The newest committed version of a row, regardless of any snapshot. */
  const latestCommitted = (row: string): Version => {
    const chain = versions
      .filter((v) => v.row === row && v.committed && !v.aborted)
      .sort((a, b) => a.beginTs - b.beginTs);
    return chain[chain.length - 1];
  };

  const frame = (): VersionsState => ({
    rows: rowKeys.map<MvccRowFrame>((key) => ({
      key,
      versions: versions
        .filter((v) => v.row === key)
        .sort((a, b) => a.beginTs - b.beginTs)
        .map<VersionFrame>((v) => ({
          row: v.row,
          value: v.value,
          createdBy: v.createdBy,
          beginTs: v.beginTs,
          commitTs: v.commitTs,
          committed: v.committed,
          aborted: v.aborted,
          active: v.row === activeRow && v.beginTs === activeBeginTs,
          readNow: v.row === readRow && v.beginTs === readBeginTs,
        })),
    })),
    txns: runtimes.map<MvccTxnFrame>((rt) => ({
      id: rt.txn.id,
      name: rt.txn.name,
      status: rt.status,
      startTs: rt.startTs ?? undefined,
      seen: { ...rt.seen },
      next: rt.status === "active" || rt.status === "idle"
        ? rt.txn.statements[rt.pc]?.label
        : undefined,
    })),
    active,
    ranStatement,
    clock,
    snapshotNote,
    conflict,
  });

  const rec = new StepRecorder<VersionsState>(frame);
  rec.record({ note: "Snapshot isolation — every row has one committed version, nothing has run yet" });

  const unfinished = () =>
    runtimes.filter(
      (rt) =>
        rt.status !== "committed" &&
        rt.status !== "aborted" &&
        rt.pc < rt.txn.statements.length,
    );

  // Every iteration advances exactly one statement, so the total is an exact
  // ceiling — there is no waiting here (readers never block), so no extra budget.
  const budget = program.txns.reduce((n, t) => n + t.statements.length, 0);
  for (let guard = 0; guard < budget; guard++) {
    const alive = unfinished();
    if (alive.length === 0) break;

    const chosen = alive[Math.floor(rng() * alive.length)];
    const statement = chosen.txn.statements[chosen.pc];
    activeRow = undefined;
    activeBeginTs = undefined;
    readRow = undefined;
    readBeginTs = undefined;
    snapshotNote = undefined;
    conflict = undefined;

    // The transaction begins now: this is when its snapshot timestamp is taken.
    if (chosen.startTs === null) {
      clock += 1;
      chosen.startTs = clock;
      chosen.status = "active";
    }

    let aborted = false;
    if (statement.run) {
      const ctx: MvccContext = {
        read: (row) => {
          const version = visibleTo(chosen, row);
          chosen.seen[row] = version.value;
          readRow = row;
          readBeginTs = version.beginTs;
          const newest = latestCommitted(row);
          // Read an OLD version: a newer committed one exists but was committed
          // after this transaction's snapshot, so it is invisible.
          if (
            version.committed &&
            newest.beginTs > version.beginTs &&
            newest.createdBy !== chosen.txn.id
          ) {
            rec.bump(MVCC_COUNTERS.snapshotReads);
            snapshotNote = `${chosen.txn.name} reads ${row}=${version.value} from its snapshot, though a newer committed ${row}=${newest.value} exists`;
          }
          return version.value;
        },
        write: (row, value) => {
          clock += 1;
          const version: Version = {
            row,
            value,
            createdBy: chosen.txn.id,
            beginTs: clock,
            committed: false,
            aborted: false,
          };
          versions.push(version);
          chosen.written.add(row);
          activeRow = row;
          activeBeginTs = clock;
          rec.bump(MVCC_COUNTERS.versions);
        },
        seen: chosen.seen,
      };
      if (statement.run(ctx) === "abort") aborted = true;
    }

    if (aborted) {
      for (const v of versions) {
        if (v.createdBy === chosen.txn.id && !v.committed) v.aborted = true;
      }
      chosen.status = "aborted";
    } else if (statement.commit) {
      /*
       * First-committer-wins. If any row this transaction wrote has a version
       * that another transaction committed AFTER this one's snapshot, then this
       * transaction based its write on a value that is no longer current, and
       * committing would silently lose that other write. So the commit is
       * refused and the transaction aborts — the write-write conflict a lost
       * update becomes under MVCC.
       */
      const clash = [...chosen.written].filter((row) => {
        const newest = latestCommitted(row);
        return (
          newest.createdBy !== chosen.txn.id &&
          newest.commitTs !== undefined &&
          newest.commitTs > (chosen.startTs ?? 0)
        );
      });

      if (clash.length > 0) {
        for (const v of versions) {
          if (v.createdBy === chosen.txn.id && !v.committed) v.aborted = true;
        }
        chosen.status = "aborted";
        rec.bump(MVCC_COUNTERS.conflicts);
        conflict = `${chosen.txn.name}: ${clash.join(", ")} was committed by another transaction since its snapshot — commit refused`;
        chosen.pc += 1;
        active = chosen.txn.id;
        ranStatement = `${statement.label} refused`;
        rec.bump(MVCC_COUNTERS.statements);
        rec.record({
          codeLine: statement.codeLine,
          note: `${chosen.txn.name}: write-write conflict on ${clash.join(", ")}, rolled back`,
        });
        continue;
      }

      clock += 1;
      for (const v of versions) {
        if (v.createdBy === chosen.txn.id && !v.committed) {
          v.committed = true;
          v.commitTs = clock;
        }
      }
      chosen.status = "committed";
    }

    chosen.pc += 1;
    if (chosen.status === "active" && chosen.pc >= chosen.txn.statements.length) {
      // Ran off the end without committing: treat as finished, not committed.
      chosen.status = "aborted";
      for (const v of versions) {
        if (v.createdBy === chosen.txn.id && !v.committed) v.aborted = true;
      }
    }

    active = chosen.txn.id;
    ranStatement = statement.label;
    rec.bump(MVCC_COUNTERS.statements);
    rec.record({
      codeLine: statement.codeLine,
      note: `${chosen.txn.name}: ${statement.label}`,
    });
  }

  return rec.steps;
}
