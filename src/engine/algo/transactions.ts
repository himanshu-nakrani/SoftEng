import { StepRecorder } from "./recorder";
import type { AlgoStep } from "./types";
import type { RowFrame, TableState, TxnFrame, TxnStatus } from "./views/table";

/**
 * Transactions — a step producer for archetype B, over `TableState`.
 *
 * WHY NOT `interleave`. Concurrency's scheduler is thread-flavoured: program
 * counters, lock acquire/release, condition waits. A transaction interleaving
 * shares the *idea* (seeded choice among runnable actors) but not the vocabulary
 * — what matters here is statements, a committed/pending split per row, and
 * commit-or-abort. Bending threads into transactions would hide exactly the thing
 * the lessons are about, so this owns its own small scheduler, the way
 * `mutation.ts` and `repo.ts` do.
 *
 * ISOLATION IS MODELLED, NOT ASSERTED. A read consults `visibleTo`, which is the
 * only place a level's rule lives. So "read uncommitted sees a dirty value" is
 * something the run demonstrates rather than something the prose claims.
 */

export type Isolation =
  | "read uncommitted"
  | "read committed"
  | "repeatable read"
  | "serializable";

/** The database as the statements see it. */
export interface Db {
  /** Durable values. */
  committed: Record<string, number>;
  /** Uncommitted writes: row → txn id → value. */
  pending: Record<string, Record<string, number>>;
  /** Row → transaction holding it exclusively, under two-phase locking. */
  locks: Record<string, string | undefined>;
}

export interface StatementContext {
  /** Read a row under the run's isolation level. */
  read: (row: string) => number;
  /** Write a row as this transaction's pending value. */
  write: (row: string, value: number) => void;
  /** What this transaction has read so far, for display. */
  seen: Record<string, number>;
}

/** One statement of a transaction. Returning "abort" rolls the transaction back. */
export interface Statement {
  label: string;
  codeLine?: number;
  run?: (ctx: StatementContext) => void | "abort";
  /** Marks the commit point; pending writes become committed. */
  commit?: boolean;
  /**
   * Rows this statement must hold exclusively before it can run, under
   * `mechanism: "2pl"`. Ignored otherwise. Held until the transaction ends —
   * that is the "two-phase" part: acquire in the first phase, release in the
   * second, never interleaved.
   */
  locks?: string[];
}

export interface Txn {
  id: string;
  name: string;
  statements: Statement[];
}

export interface TxnProgram {
  /** Initial committed values, keyed by row. */
  rows: Record<string, number>;
  txns: Txn[];
  isolation: Isolation;
  /**
   * HOW serializability is achieved, when `isolation` is `"serializable"`.
   *
   * - `"snapshot"` (default) is optimistic: read from a snapshot, then refuse the
   *   commit if anything read has changed. Work can be wasted, and the caller
   *   must retry.
   * - `"2pl"` is pessimistic: take an exclusive lock at read time and hold it
   *   until commit, so a conflicting transaction WAITS instead of failing. No
   *   wasted work and no retry — paid for in blocking.
   *
   * Same guarantee, opposite failure mode. That contrast is the lesson.
   */
  mechanism?: "snapshot" | "2pl";
}

export const TXN_COUNTERS = {
  /** Statements executed. */
  statements: "statements",
  /** Reads that returned another transaction's uncommitted value. */
  dirtyReads: "dirtyReads",
  /** Transactions rolled back. */
  aborts: "aborts",
  /**
   * Transactions the database refused to commit because the data they read had
   * changed underneath them — the cost serializable charges, and the thing
   * application code has to be ready to retry.
   */
  conflicts: "conflicts",
} as const;

interface Runtime {
  txn: Txn;
  pc: number;
  status: TxnStatus;
  seen: Record<string, number>;
  /** Row this transaction is waiting to lock, under 2PL. */
  waitingOn?: string;
  /**
   * Committed values as of this transaction's FIRST statement, under repeatable
   * read. Taken lazily rather than at program start because a transaction that
   * has not run yet has not begun, and a snapshot it never used would be a lie
   * about when it started.
   */
  snapshot: Record<string, number> | null;
  /**
   * Rows this transaction has read. Under `serializable`, a commit is refused if
   * any of them changed since the snapshot: the decision was based on data that
   * is no longer true, which is exactly the write-skew case a snapshot alone
   * cannot catch.
   */
  readSet: Set<string>;
}

/**
 * Run the program, one frame per statement, choosing among unfinished
 * transactions with `rng`.
 */
export function runTransactions(
  program: TxnProgram,
  rng: () => number,
): AlgoStep<TableState>[] {
  const rowKeys = Object.keys(program.rows);
  const db: Db = {
    committed: { ...program.rows },
    pending: Object.fromEntries(rowKeys.map((key) => [key, {}])),
    locks: {},
  };

  const twoPhase =
    program.isolation === "serializable" && program.mechanism === "2pl";

  /**
   * Rows a statement needs locked before it can run, under 2PL.
   *
   * Declared on the statement rather than inferred, because what a statement is
   * ABOUT to do is not visible from here — and `SELECT … FOR UPDATE` is exactly
   * the case where a read must take a write lock.
   */
  const blockedRow = (rt: Runtime): string | undefined => {
    if (!twoPhase) return undefined;
    const statement = rt.txn.statements[rt.pc];
    for (const row of statement.locks ?? []) {
      const holder = db.locks[row];
      if (holder !== undefined && holder !== rt.txn.id) return row;
    }
    return undefined;
  };

  const runtimes: Runtime[] = program.txns.map((txn) => ({
    txn,
    pc: 0,
    status: "active",
    seen: {},
    snapshot: null,
    readSet: new Set<string>(),
  }));

  let active: string | null = null;
  let ranStatement: string | undefined;
  let anomaly: string | undefined;

  /**
   * The isolation rule, and the only place it lives.
   *
   * `read uncommitted` will hand back another transaction's pending write —
   * that IS the dirty read. `read committed` never looks at `pending` for
   * anybody else, though a transaction always sees its own writes, because a
   * statement that could not read what it just wrote would be unusable.
   */
  const visibleTo = (
    rt: Runtime,
    row: string,
  ): { value: number; dirty: boolean } => {
    const txnId = rt.txn.id;
    const pending = db.pending[row] ?? {};
    // A transaction always sees its own writes; a statement that could not read
    // what it just wrote would be unusable at any level.
    if (pending[txnId] !== undefined) return { value: pending[txnId], dirty: false };

    if (program.isolation === "read uncommitted") {
      const other = Object.entries(pending).find(([id]) => id !== txnId);
      if (other) return { value: other[1], dirty: true };
    }

    // Repeatable read answers from the snapshot taken when this transaction
    // began, so a value cannot change underneath it mid-transaction — even
    // though every value it returns was committed at some point.
    // 2PL reads the CURRENT committed value: it does not need a snapshot,
    // because the lock already prevents the value from moving underneath it.
    if (
      !twoPhase &&
      (program.isolation === "repeatable read" ||
        program.isolation === "serializable") &&
      rt.snapshot
    ) {
      return { value: rt.snapshot[row], dirty: false };
    }

    return { value: db.committed[row], dirty: false };
  };

  const frame = (): TableState => ({
    rows: rowKeys.map<RowFrame>((key) => ({
      key,
      committed: db.committed[key],
      pending: { ...(db.pending[key] ?? {}) },
      lockedBy: db.locks[key],
    })),
    txns: runtimes.map<TxnFrame>((rt) => ({
      id: rt.txn.id,
      name: rt.txn.name,
      status: rt.status,
      seen: { ...rt.seen },
      next: rt.status === "active" ? rt.txn.statements[rt.pc]?.label : undefined,
      waitingOn: rt.waitingOn,
    })),
    active,
    ranStatement,
    isolation: program.isolation,
    anomaly,
  });

  const rec = new StepRecorder<TableState>(frame);
  rec.record({ note: `${program.isolation} — nothing has run yet` });

  const unfinished = () =>
    runtimes.filter((rt) => rt.status === "active" && rt.pc < rt.txn.statements.length);

  // Every iteration advances one statement, so the total is an exact ceiling.
  const total = program.txns.reduce((n, t) => n + t.statements.length, 0);
  // With 2PL a transaction can wait, so a run may need more iterations than it
  // has statements. The ceiling stays finite: every iteration either advances a
  // statement or resolves a deadlock by aborting somebody.
  const budget = twoPhase ? total * 4 + 8 : total;
  for (let guard = 0; guard < budget; guard++) {
    const alive = unfinished();
    if (alive.length === 0) break;

    const ready = alive.filter((rt) => blockedRow(rt) === undefined);
    for (const rt of alive) rt.waitingOn = blockedRow(rt);

    if (ready.length === 0) {
      // Everyone left is waiting for a lock nobody will release: a deadlock.
      // Real engines pick a victim; so does this, and the choice is seeded.
      const victim = alive[Math.floor(rng() * alive.length)];
      for (const row of rowKeys) {
        const pendingRow = { ...(db.pending[row] ?? {}) };
        delete pendingRow[victim.txn.id];
        db.pending[row] = pendingRow;
        if (db.locks[row] === victim.txn.id) db.locks[row] = undefined;
      }
      victim.status = "aborted";
      victim.waitingOn = undefined;
      rec.bump(TXN_COUNTERS.aborts);
      rec.bump(TXN_COUNTERS.conflicts);
      active = victim.txn.id;
      ranStatement = "chosen as deadlock victim";
      rec.record({ note: `${victim.txn.name}: deadlock — rolled back` });
      continue;
    }

    const chosen = ready[Math.floor(rng() * ready.length)];
    const statement = chosen.txn.statements[chosen.pc];

    // The transaction begins now, so this is when its snapshot is taken.
    if (chosen.snapshot === null) chosen.snapshot = { ...db.committed };

    if (twoPhase) {
      for (const row of statement.locks ?? []) db.locks[row] = chosen.txn.id;
    }

    let aborted = false;
    if (statement.run) {
      const ctx: StatementContext = {
        read: (row) => {
          const { value, dirty } = visibleTo(chosen, row);
          chosen.seen[row] = value;
          chosen.readSet.add(row);
          if (dirty) {
            rec.bump(TXN_COUNTERS.dirtyReads);
            anomaly = `${chosen.txn.name} read ${row}=${value}, which no transaction has committed`;
          }
          return value;
        },
        write: (row, value) => {
          db.pending[row] = { ...(db.pending[row] ?? {}), [chosen.txn.id]: value };
        },
        seen: chosen.seen,
      };
      if (statement.run(ctx) === "abort") aborted = true;
    }

    if (aborted) {
      // Roll back: discard every pending write. Anything another transaction
      // already read from them is now a value that never existed.
      for (const row of rowKeys) {
        const pending = { ...(db.pending[row] ?? {}) };
        delete pending[chosen.txn.id];
        db.pending[row] = pending;
      }
      chosen.status = "aborted";
      for (const row of rowKeys) {
        if (db.locks[row] === chosen.txn.id) db.locks[row] = undefined;
      }
      rec.bump(TXN_COUNTERS.aborts);
    } else if (statement.commit) {
      /*
       * Serializable: refuse the commit if anything this transaction READ has
       * changed since it began. Two transactions can each hold a perfectly
       * consistent snapshot, each make a locally valid decision, and together
       * break an invariant neither violated alone — a snapshot cannot see that,
       * because the conflict is between one transaction's reads and another's
       * writes. Comparing the read set against the snapshot is what sees it.
       */
      const stale =
        program.isolation === "serializable" && chosen.snapshot
          ? [...chosen.readSet].filter(
              (row) => db.committed[row] !== chosen.snapshot![row],
            )
          : [];

      if (stale.length > 0) {
        for (const row of rowKeys) {
          const pending = { ...(db.pending[row] ?? {}) };
          delete pending[chosen.txn.id];
          db.pending[row] = pending;
        }
        chosen.status = "aborted";
        for (const row of rowKeys) {
          if (db.locks[row] === chosen.txn.id) db.locks[row] = undefined;
        }
        rec.bump(TXN_COUNTERS.aborts);
        rec.bump(TXN_COUNTERS.conflicts);
        anomaly = undefined;
        chosen.pc += 1;
        active = chosen.txn.id;
        ranStatement = `${statement.label} refused — ${stale.join(", ")} changed`;
        rec.bump(TXN_COUNTERS.statements);
        rec.record({
          codeLine: statement.codeLine,
          note: `${chosen.txn.name}: serialization failure on ${stale.join(", ")}`,
        });
        continue;
      }

      for (const row of rowKeys) {
        const pending = { ...(db.pending[row] ?? {}) };
        if (pending[chosen.txn.id] !== undefined) {
          db.committed[row] = pending[chosen.txn.id];
          delete pending[chosen.txn.id];
        }
        db.pending[row] = pending;
      }
      chosen.status = "committed";
      // Phase two: every lock released, all at once, at the end.
      for (const row of rowKeys) {
        if (db.locks[row] === chosen.txn.id) db.locks[row] = undefined;
      }
    }

    chosen.pc += 1;
    if (chosen.status === "active" && chosen.pc >= chosen.txn.statements.length) {
      // Ran off the end without committing: treat as finished, not committed.
      chosen.status = "aborted";
    }

    active = chosen.txn.id;
    ranStatement = statement.label;
    rec.bump(TXN_COUNTERS.statements);
    rec.record({
      codeLine: statement.codeLine,
      note: `${chosen.txn.name}: ${statement.label}`,
    });
  }

  return rec.steps;
}
