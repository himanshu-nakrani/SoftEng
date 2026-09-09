import { StepRecorder } from "./recorder";
import type { AlgoStep } from "./types";
import type {
  LogRecordFrame,
  PageFrame,
  WalState,
  WalTxnFrame,
  WalTxnStatus,
} from "./views/wal";

/**
 * Write-ahead logging — a step producer for archetype B, over `WalState`.
 *
 * The fifth thing to ride the discrete-step engine, and the first in track 03
 * that is not an interleaving. There is no scheduler here: durability is not
 * about which actor goes next, it is about WHEN state stops being volatile. So
 * this producer takes no scheduling decisions at all, and the run is a fixed
 * sequence of operations interrupted at a chosen point by a power failure.
 *
 * WHAT IS MODELLED, AND WHAT IS NOT. Three storage locations: a buffer pool
 * (volatile), a log with a forced prefix (the prefix is durable, the tail is
 * not), and the pages on disk (durable). A crash discards the buffer pool and
 * the unforced log tail, and nothing else. Recovery is ARIES reduced to its
 * two load-bearing passes — redo committed changes forward, undo uncommitted
 * ones backward — with analysis collapsed into a single scan of the durable log,
 * because with no fuzzy checkpoints there is nothing for a separate analysis
 * pass to discover.
 *
 * Deliberately absent: group commit, log buffering policy beyond
 * force-at-commit, partial page writes, and non-atomic sector writes. Those
 * change the constants, not the argument. The argument is that a commit can be
 * made durable by forcing ONE sequential write instead of every page the
 * transaction touched, and that the price of doing so is a rule about ordering.
 *
 * THE RULE IS MODELLED, NOT ASSERTED. `flushPage` under `write-ahead` refuses to
 * put a page on disk while the log records describing it are still volatile, and
 * forces the log first — so the fsync count is where the rule shows up as a cost.
 * Under `pages-only` there is no log to force, and the same page write leaves
 * behind an uncommitted value that nothing can roll back. That difference is
 * produced by the two policies, not narrated by the prose.
 */

/** One operation in a durability script. */
export type WalOp =
  /** Modify a page in the buffer pool. Logged first, under `write-ahead`. */
  | { kind: "write"; txn: string; page: string; value: number }
  /** Report success to the caller. What that costs depends on the policy. */
  | { kind: "commit"; txn: string }
  /** The buffer manager evicting a dirty page, or a background flush. */
  | { kind: "flush"; page: string }
  /** Force everything dirty, so recovery has less to do. */
  | { kind: "checkpoint" }
  /**
   * One fsync for every commit record waiting in the tail. Marks where a batch
   * force happens; a no-op unless `commitPolicy` is `"grouped"`.
   */
  | { kind: "groupFlush" };

export type WalPolicy =
  /**
   * No log. The pages on disk are the only durable state, so a commit is only as
   * safe as whichever pages happen to have been written. This is the naive
   * design, and the lesson is what it loses.
   */
  | "pages-only"
  /**
   * A log record is appended before the change it describes, the log is forced
   * at commit, and no page may reach disk while the records describing it are
   * still volatile.
   */
  | "write-ahead";

export interface WalScript {
  /** Initial page values, keyed by page id. Same on disk and in the pool. */
  pages: Record<string, number>;
  txns: { id: string; name: string }[];
  ops: WalOp[];
  /**
   * How many operations execute before the power fails. The lesson's control:
   * every value is a different crash, and the interesting ones are the crashes
   * between a commit and the page writes that would have made it durable.
   *
   * At or above `ops.length` no crash happens at all. Callers that care about a
   * verdict should stay below it: with a transaction still in flight, neither
   * "its writes should be on disk" nor "they should not" is true yet, so there is
   * nothing for recovery to be right or wrong about.
   */
  crashAfter: number;
  policy: WalPolicy;
  /**
   * Whether a `checkpoint` op actually takes one. Defaults to true.
   *
   * A POLICY rather than a different script, so two runs can be compared at the
   * same crash point: the op marks where a checkpoint would go, and this decides
   * whether it happens. Building a second, shorter script instead would shift
   * every later operation, and "crash after 6" would then mean different work in
   * the two runs — which is exactly the comparison the lesson needs to be exact.
   */
  checkpoints?: boolean;
  /**
   * When the log is forced, and therefore when a caller is answered.
   *
   * - `"per-commit"` (default) forces at every commit: lowest latency, one fsync
   *   per transaction.
   * - `"grouped"` appends commit records and forces them together at a
   *   `groupFlush` op: one fsync for the batch, and every transaction in it waits
   *   for the slowest.
   *
   * A POLICY over one script, for the same reason `checkpoints` is: the two runs
   * have to be comparable at the same crash point.
   */
  commitPolicy?: "per-commit" | "grouped";
}

export const WAL_COUNTERS = {
  /** Records appended to the log. Zero under `pages-only`. */
  logRecords: "logRecords",
  /**
   * Log forces. The cost of durability under `write-ahead`: one sequential
   * write per commit, plus any the write-ahead rule demands before a page write.
   */
  fsyncs: "fsyncs",
  /** Pages written to disk — random I/O, and the expensive kind. */
  pageWrites: "pageWrites",
  /** Log records applied by recovery, whether redone or undone. */
  repaired: "repaired",
  /**
   * Log records REDO had to consider. Distinct from `repaired`, and the number a
   * checkpoint actually bounds: a checkpoint does not make the repair smaller, it
   * makes the prefix of the log that still matters shorter.
   *
   * Scoped to redo on purpose. Undo's bound is the oldest transaction still
   * running, not the checkpoint, so counting both passes here would blur the one
   * number the checkpoint is responsible for.
   */
  scanned: "scanned",
} as const;

const POLICY_LABEL: Record<WalPolicy, string> = {
  "pages-only": "pages only · no log",
  "write-ahead": "write-ahead log",
};

/**
 * Run the script, one frame per operation, then crash and recover.
 *
 * Takes no RNG: a power failure is not a random event here, it is the control
 * the lesson hands the reader.
 */
export function runWal(script: WalScript): AlgoStep<WalState>[] {
  const logged = script.policy === "write-ahead";
  const grouped = script.commitPolicy === "grouped";

  // Volatile.
  const buffered: Record<string, number> = { ...script.pages };
  let poolLost = false;

  // Durable.
  const disk: Record<string, number> = { ...script.pages };
  const pageLsn: Record<string, number> = {};
  const diskLsn: Record<string, number> = {};
  for (const id of Object.keys(script.pages)) {
    pageLsn[id] = 0;
    diskLsn[id] = 0;
  }

  const log: LogRecordFrame[] = [];
  let flushedUpTo = 0;

  const status: Record<string, WalTxnStatus> = {};
  const acked: Record<string, boolean> = {};
  for (const txn of script.txns) {
    status[txn.id] = "active";
    acked[txn.id] = false;
  }

  let phase: WalState["phase"] = "run";
  let violation: string | undefined;
  // Explicitly initialised: the recorder's closure reads this on every frame,
  // including the frames before recovery has a verdict to give.
  let verdict: string | undefined = undefined;
  let lostCommit = false;
  let activePage: string | undefined;
  let activeLsn: number | undefined;

  /** Pages recovery has touched, so the view can mark what redo/undo changed. */
  const repairedPages = new Set<string>();

  const rec = new StepRecorder<WalState>(() => ({
    phase,
    pages: Object.keys(script.pages).map<PageFrame>((id) => ({
      id,
      buffered: poolLost ? undefined : buffered[id],
      disk: disk[id],
      dirty: !poolLost && buffered[id] !== disk[id],
      pageLsn: pageLsn[id],
      diskLsn: diskLsn[id],
      active: id === activePage,
      repaired: repairedPages.has(id),
    })),
    // Copied per frame, and each record copied too: the flags below (durable,
    // lost, redone) mutate as the run proceeds, so a shared reference would make
    // every earlier frame show the final state of the log.
    log: log.map((r) => ({ ...r, active: r.lsn === activeLsn })),
    flushedUpTo,
    txns: script.txns.map<WalTxnFrame>((t) => ({
      id: t.id,
      name: t.name,
      status: status[t.id],
      acknowledged: acked[t.id],
    })),
    policy: POLICY_LABEL[script.policy],
    logged,
    violation,
    verdict,
    lostCommit,
    acknowledged: script.txns.filter((t) => acked[t.id]).length,
  }));

  function append(
    kind: LogRecordFrame["kind"],
    fields: Partial<LogRecordFrame> = {},
  ): number {
    const lsn = log.length + 1;
    log.push({ lsn, kind, durable: false, ...fields });
    rec.bump(WAL_COUNTERS.logRecords);
    return lsn;
  }

  /**
   * fsync the log up to `lsn`. Sequential, and the cheap kind of durable.
   *
   * ACKNOWLEDGEMENT HAPPENS HERE, and only here. A transaction may be reported
   * successful exactly when its commit record is durable — so making that a
   * consequence of the force, rather than something the commit op does for
   * itself, is what lets one force answer several transactions at once. It also
   * means an unrelated force (a page flush that had to outrun the log) correctly
   * acknowledges any commit it happens to carry over the line.
   */
  function forceLog(upTo: number): void {
    if (upTo <= flushedUpTo) return;
    for (const r of log) if (r.lsn <= upTo) r.durable = true;
    flushedUpTo = upTo;
    rec.bump(WAL_COUNTERS.fsyncs);
    for (const r of log) {
      if (r.kind !== "commit" || !r.durable || !r.txn) continue;
      if (acked[r.txn]) continue;
      acked[r.txn] = true;
      status[r.txn] = "committed";
    }
  }

  function writePage(id: string): void {
    disk[id] = buffered[id];
    diskLsn[id] = pageLsn[id];
    rec.bump(WAL_COUNTERS.pageWrites);
  }

  rec.record({ note: "Before anything: the pool and the disk agree." });

  const executed = Math.min(script.crashAfter, script.ops.length);

  for (let i = 0; i < executed; i++) {
    const op = script.ops[i];
    activePage = undefined;
    activeLsn = undefined;

    if (op.kind === "write") {
      activePage = op.page;
      const before = buffered[op.page];
      if (logged) {
        // WRITE-AHEAD, as two frames rather than one: the record describing the
        // change is appended BEFORE the change happens, so the before-image is
        // captured while it is still true. Splitting the frames is the point —
        // a reader can see which of the two comes first.
        activeLsn = append("write", {
          txn: op.txn,
          page: op.page,
          before,
          after: op.value,
        });
        pageLsn[op.page] = activeLsn;
        rec.record({
          codeLine: 1,
          note: `${op.txn} logs the change first — ${op.page} ${before} to ${op.value}, as LSN ${activeLsn}. The pool still holds ${before}, and the record is not forced yet.`,
        });
      }
      buffered[op.page] = op.value;
      rec.record({
        codeLine: 0,
        note: logged
          ? `Now the pool holds ${op.value}. Disk still reads ${disk[op.page]}, and that is allowed: the log already knows how to get here.`
          : `${op.txn} changes ${op.page} to ${op.value} in the pool. Nothing anywhere describes the change, so nothing can replay or reverse it.`,
      });
      continue;
    }

    if (op.kind === "commit") {
      status[op.txn] = "committing";
      if (logged) {
        activeLsn = append("commit", { txn: op.txn });
        rec.record({
          codeLine: 2,
          note: `${op.txn} asks to commit. The commit record is appended as LSN ${activeLsn}, but it is still in the volatile tail — nothing may be reported yet.`,
        });
        if (grouped) {
          // Group commit: no force here. The record waits for a batch force, and
          // so does the caller.
          rec.record({
            codeLine: 3,
            note: `No fsync. ${op.txn} is logically finished but still waiting — its record will be forced along with the others.`,
          });
          continue;
        }
        // Its own frame, because it is the moment the promise becomes true: ONE
        // sequential force, however many pages the transaction touched.
        forceLog(activeLsn);
        rec.record({
          codeLine: 3,
          note: `One fsync forces the log to LSN ${activeLsn}. ${op.txn} can now report success — and not one of its pages is on disk.`,
        });
      } else {
        acked[op.txn] = true;
        status[op.txn] = "committed";
        rec.record({
          codeLine: 2,
          note: `${op.txn} commits and reports success. Nothing was forced anywhere, so the promise rests entirely on whichever pages happen to get written later.`,
        });
      }
      continue;
    }

    if (op.kind === "groupFlush") {
      if (!grouped || !logged) {
        rec.record({
          codeLine: 3,
          note: "A batch force could happen here. This run forces at every commit instead, so there is nothing left waiting.",
        });
        continue;
      }
      const waiting = script.txns.filter((t) => status[t.id] === "committing");
      activeLsn = log.length;
      forceLog(log.length);
      rec.record({
        codeLine: 3,
        note: `One fsync forces the whole tail. ${waiting.length === 0 ? "Nothing was waiting" : `${list(waiting.map((t) => t.id))} can all report success now`} — ${waiting.length} transaction${waiting.length === 1 ? "" : "s"} made durable by a single write.`,
      });
      continue;
    }

    if (op.kind === "flush") {
      activePage = op.page;
      if (logged && pageLsn[op.page] > flushedUpTo) {
        // The write-ahead rule, as an action rather than a claim: this page
        // cannot go to disk yet, so the log is forced first.
        activeLsn = pageLsn[op.page];
        forceLog(pageLsn[op.page]);
        writePage(op.page);
        rec.record({
          codeLine: 4,
          note: `${op.page} is dirty up to LSN ${pageLsn[op.page]}, past the forced prefix, so the log is forced FIRST and only then is the page written.`,
        });
        continue;
      }
      const owner = ownerOf(script, i, op.page);
      const strands = owner !== undefined && status[owner] !== "committed";
      writePage(op.page);
      if (strands && !logged) {
        violation = `${op.page}=${disk[op.page]} is on disk from uncommitted ${owner}, and no log record can undo it`;
      }
      rec.record({
        codeLine: 4,
        note:
          strands && !logged
            ? `${op.page} reaches disk carrying ${owner}'s uncommitted value. There is no before-image anywhere, so this cannot be taken back.`
            : `${op.page} reaches disk. The forced log prefix already covers it, so no fsync was needed.`,
      });
      continue;
    }

    // checkpoint
    if (script.checkpoints === false) {
      rec.record({
        codeLine: 4,
        note: "A checkpoint could be taken here. This run does not take one, so every dirty page stays only in memory.",
      });
      continue;
    }
    for (const id of Object.keys(script.pages)) {
      if (buffered[id] !== disk[id]) {
        if (logged) forceLog(pageLsn[id]);
        writePage(id);
      }
    }
    if (logged) {
      activeLsn = append("checkpoint");
      forceLog(log.length);
    }
    rec.record({
      codeLine: 4,
      note: "Checkpoint: every dirty page forced out, so recovery has less to replay.",
    });
  }

  // ---- the power fails -------------------------------------------------------

  const crashed = script.crashAfter < script.ops.length;
  const acknowledged = script.txns.filter((t) => acked[t.id]).map((t) => t.id);

  if (crashed) {
    phase = "crash";
    poolLost = true;
    activePage = undefined;
    activeLsn = undefined;
    let lostTail = 0;
    for (const r of log) {
      if (!r.durable) {
        r.lost = true;
        lostTail++;
      }
    }
    // Anything unacknowledged is lost, whether it had not started committing or
    // was waiting for a force. Both had a promise outstanding to nobody.
    for (const t of script.txns) {
      if (!acked[t.id]) status[t.id] = "lost";
    }
    rec.record({
      codeLine: 5,
      note: `Power lost. The buffer pool is gone, along with ${lostTail} log record${lostTail === 1 ? "" : "s"} that were never forced. Only the disk pages and the forced log prefix are left.`,
    });
  }

  // ---- recovery -------------------------------------------------------------

  phase = "recover";

  if (!logged) {
    rec.record({
      codeLine: 6,
      note: "Restart. There is no log, so there is nothing to replay and nothing to roll back: whatever is on disk is now the truth.",
    });
  } else {
    // Analysis, collapsed into one scan: a transaction is committed if and only
    // if its commit record made it into the durable prefix.
    const durable = log.filter((r) => r.lsn <= flushedUpTo);
    const committed = new Set(
      durable.filter((r) => r.kind === "commit" && r.txn).map((r) => r.txn as string),
    );

    /*
     * WHERE REDO STARTS, and why it is allowed to start there.
     *
     * A checkpoint here is SHARP: it forces every dirty page before writing its
     * record. So at the moment that record became durable, the disk already held
     * every change logged before it, and no record older than the checkpoint can
     * have anything left to replay. Redo may therefore begin at the last durable
     * checkpoint, and that — not a smaller repair — is what a checkpoint buys.
     *
     * A FUZZY checkpoint (one that does not stop the world to flush) cannot claim
     * this, and real systems carry the oldest dirty page's LSN in the record to
     * recover the bound. Not modelled: it changes where redo starts, not why.
     */
    const lastCheckpoint = durable.filter((r) => r.kind === "checkpoint").pop();
    const redoFrom = lastCheckpoint?.lsn ?? 0;
    const redoWindow = durable.filter((r) => r.lsn >= redoFrom);

    rec.record({
      codeLine: 6,
      note: lastCheckpoint
        ? `Restart. The durable log holds ${durable.length} record${durable.length === 1 ? "" : "s"}, but redo may start at LSN ${redoFrom}, the last checkpoint — ${redoWindow.length} of them, not ${durable.length}.`
        : `Restart. The durable log holds ${durable.length} record${durable.length === 1 ? "" : "s"} and there is no checkpoint, so redo must consider all of them.`,
    });

    // REDO, forward from the checkpoint. `diskLsn` is what makes this idempotent:
    // a change already on disk is skipped, so recovery may be interrupted and
    // run again.
    for (const r of redoWindow) {
      rec.bump(WAL_COUNTERS.scanned);
      if (r.kind !== "write" || !r.page || !committed.has(r.txn as string)) continue;
      if (diskLsn[r.page] >= r.lsn) continue;
      disk[r.page] = r.after as number;
      diskLsn[r.page] = r.lsn;
      r.redone = true;
      repairedPages.add(r.page);
      rec.bump(WAL_COUNTERS.repaired);
      rec.bump(WAL_COUNTERS.pageWrites);
      activePage = r.page;
      activeLsn = r.lsn;
      rec.record({
        codeLine: 6,
        note: `Redo LSN ${r.lsn}: ${r.txn} committed, so ${r.page} becomes ${r.after} on disk.`,
      });
    }

    /*
     * UNDO, backward, over the WHOLE durable log — deliberately not bounded by
     * the checkpoint.
     *
     * The checkpoint bound is a statement about pages reaching disk, and undo is
     * not looking for that. It is looking for transactions that never committed,
     * and one of those may have started long before the checkpoint and still be
     * running at the crash. Stopping undo at the checkpoint would leave its
     * earlier writes on disk forever.
     *
     * The two passes have different bounds because they answer different
     * questions, which is the part of recovery that is easy to get wrong.
     */
    for (const r of [...durable].reverse()) {
      if (r.kind !== "write" || !r.page || committed.has(r.txn as string)) continue;
      if (diskLsn[r.page] < r.lsn) continue;
      disk[r.page] = r.before as number;
      diskLsn[r.page] = r.lsn - 1;
      r.undone = true;
      repairedPages.add(r.page);
      rec.bump(WAL_COUNTERS.repaired);
      rec.bump(WAL_COUNTERS.pageWrites);
      activePage = r.page;
      activeLsn = r.lsn;
      rec.record({
        codeLine: 7,
        note: `Undo LSN ${r.lsn}: ${r.txn} never committed, so ${r.page} goes back to ${r.before}.`,
      });
    }
  }

  // ---- verdict --------------------------------------------------------------

  phase = "done";
  activePage = undefined;
  activeLsn = undefined;

  const expected = expectedDisk(script, executed, acked);
  const names = list(acknowledged);
  const wrong = Object.keys(script.pages).filter((id) => disk[id] !== expected[id]);
  lostCommit = wrong.length > 0;
  verdict = lostCommit
    ? `${wrong
        .map((id) => `${id} is ${disk[id]}, should be ${expected[id]}`)
        .join("; ")} — ${
        acknowledged.length === 0
          ? "nothing was acknowledged, but the disk is still wrong"
          : `${names} reported success`
      }`
    : acknowledged.length === 0
      ? "Nothing had committed, and the disk holds no trace of the work in flight."
      : `${names} committed, and every change came back. Nothing uncommitted survived.`;

  rec.record({
    codeLine: logged ? 7 : 6,
    note: lostCommit ? `Durability broken. ${verdict}.` : `Durable. ${verdict}`,
  });

  return rec.steps;
}

/**
 * "T1", "T1 and T2", "T1, T2 and T3". Plain `join(" and ")` read as
 * "T1 and T2 and T3" once a script had more than two transactions.
 */
function list(ids: string[]): string {
  if (ids.length <= 1) return ids[0] ?? "";
  return `${ids.slice(0, -1).join(", ")} and ${ids[ids.length - 1]}`;
}

/** Which transaction last wrote `page`, at or before op `i`. */
function ownerOf(script: WalScript, i: number, page: string): string | undefined {
  for (let j = i; j >= 0; j--) {
    const op = script.ops[j];
    if (op.kind === "write" && op.page === page) return op.txn;
  }
  return undefined;
}

/**
 * What the disk SHOULD hold: the initial pages plus every write by a
 * transaction that reported success, and nothing from one that did not.
 *
 * This is the definition of correct that the verdict is measured against, and it
 * is deliberately independent of the machinery above — it reads the script, not
 * the log — so a bug in recovery cannot make itself look right.
 */
function expectedDisk(
  script: WalScript,
  executed: number,
  acked: Record<string, boolean>,
): Record<string, number> {
  const out = { ...script.pages };
  for (let i = 0; i < executed; i++) {
    const op = script.ops[i];
    if (op.kind === "write" && acked[op.txn]) out[op.page] = op.value;
  }
  return out;
}
