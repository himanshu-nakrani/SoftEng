/**
 * The WAL view's state contract — archetype B, for durability and recovery.
 *
 * Pure data (no JSX) so a lesson `.ts` file can model a crash without pulling a
 * component into its module graph.
 *
 * WHY A SEPARATE VIEW rather than reusing `TableView`. The transaction lessons
 * care about the gap between committed and pending — one axis, inside memory.
 * Durability cares about a different gap entirely: what survives losing power.
 * That is a split between VOLATILE state (the buffer pool, and the tail of the
 * log that has not been forced yet) and DURABLE state (the pages on disk, and
 * the log prefix that has been fsynced). A committed/pending table cannot show
 * it, because both of its columns are in memory and both of them vanish.
 *
 * So the spine of this view is a horizontal divide, and every frame answers one
 * question: if the power failed right now, what would come back?
 */

/** Which stage of the run a frame belongs to. */
export type WalPhase =
  /** Normal operation: statements executing against the buffer pool. */
  | "run"
  /** The power has just failed. Volatile state is gone. */
  | "crash"
  /** Restart: reading the durable log and repairing the pages. */
  | "recover"
  /** Recovery finished; the verdict is known. */
  | "done";

/** What a log record describes. */
export type WalRecordKind = "write" | "commit" | "abort" | "checkpoint";

/**
 * One record in the write-ahead log.
 *
 * `before` and `after` are what make recovery possible in both directions: redo
 * needs the after-image to replay a committed change, undo needs the
 * before-image to roll back one that was never committed. A log carrying only
 * one of them can only repair in one direction.
 */
export interface LogRecordFrame {
  /** Log sequence number — position in the log, and the ordering recovery uses. */
  lsn: number;
  kind: WalRecordKind;
  txn?: string;
  page?: string;
  before?: number;
  after?: number;
  /** Inside the fsynced prefix, so it would survive a crash. */
  durable: boolean;
  /** Appended or read by the step being shown. */
  active?: boolean;
  /** Was still in the volatile tail when the power failed. */
  lost?: boolean;
  /** Replayed by redo. */
  redone?: boolean;
  /** Rolled back by undo. */
  undone?: boolean;
}

/**
 * One page, in both places it can exist at once.
 *
 * The two values are the whole point: `buffered` is what a reader sees, `disk`
 * is what a crash leaves behind, and they are allowed to disagree for as long as
 * the page stays dirty.
 */
export interface PageFrame {
  id: string;
  /**
   * The copy in the buffer pool. `undefined` once the pool has been lost to a
   * crash — which is the honest representation, not a zero.
   */
  buffered?: number;
  /** The copy on disk. Survives everything. */
  disk: number;
  /** Buffered copy differs from the disk copy. */
  dirty: boolean;
  /** LSN of the newest log record describing a change to this page. */
  pageLsn: number;
  /** LSN of the newest change that has actually reached the disk copy. */
  diskLsn: number;
  /** Touched by the step being shown. */
  active?: boolean;
  /** Repaired by recovery, so the reader can see what redo/undo changed. */
  repaired?: boolean;
}

export type WalTxnStatus =
  | "active"
  /**
   * Its commit record is in the log but has not been forced, so the caller is
   * still blocked. The state that makes group commit's cost visible: the
   * transaction is logically finished and nobody has been told.
   */
  | "committing"
  | "committed"
  /** Rolled back deliberately. */
  | "aborted"
  /**
   * Was active when the power failed and had no durable commit record, so
   * recovery must roll it back. Distinct from `aborted`: nobody chose this.
   */
  | "lost";

export interface WalTxnFrame {
  id: string;
  name: string;
  status: WalTxnStatus;
  /**
   * True when the transaction reported success to its caller. The lesson lives
   * in the case where this is true and the work did not survive.
   */
  acknowledged: boolean;
}

export interface WalState {
  phase: WalPhase;
  pages: PageFrame[];
  log: LogRecordFrame[];
  /** Highest LSN known to be on disk. Everything above it is volatile. */
  flushedUpTo: number;
  txns: WalTxnFrame[];
  /** The durability policy in force, shown as the plate's subject. */
  policy: string;
  /**
   * Whether this run keeps a log at all.
   *
   * Explicit rather than derived from `log.length`, because "there is no log"
   * and "the log is empty so far" are different statements and the second is
   * true on the first frame of EVERY logged run. Inferring it labelled the
   * write-ahead figure "no log at all" at step 0.
   */
  logged: boolean;
  /**
   * Set when a page reached disk before the log records describing it — the
   * write-ahead rule broken. Recorded rather than inferred so the view can mark
   * it and a test can assert it.
   */
  violation?: string;
  /**
   * What the crash cost, once recovery has finished: whether every acknowledged
   * commit came back, and whether anything uncommitted was left behind.
   */
  verdict?: string;
  /** True when the durable state contradicts what was acknowledged. */
  lostCommit?: boolean;
  /**
   * How many transactions had been told they succeeded.
   *
   * Needed because "every acknowledged commit came back" is vacuously true when
   * the answer is zero, and a stage stamp claiming it beside three lost lanes
   * reads as a contradiction. Group commit's default frame is exactly that case.
   */
  acknowledged: number;
}
