/**
 * The table view's state contract — archetype B, for transaction lessons.
 *
 * Pure data (no JSX) so lesson `.ts` files can model transactions without pulling
 * a component into their module graph.
 *
 * WHY A SEPARATE VIEW rather than reusing `ThreadsView`. A transaction lesson is
 * an interleaving, so the scheduler is the same — but what a reader needs to see
 * is different. Threads want lanes and program counters; transactions want ROWS,
 * and specifically the gap between what is committed and what a particular
 * transaction has written but not yet committed. That gap is where every read
 * anomaly lives, and a lane diagram cannot show it.
 */

export type TxnStatus = "active" | "committed" | "aborted";

export interface TxnFrame {
  id: string;
  /** Display name, e.g. "T1 · transfer". */
  name: string;
  status: TxnStatus;
  /** What this transaction has read so far, for showing a stale read. */
  seen: Record<string, number>;
  /** The statement it is about to run, or undefined when finished. */
  next?: string;
  /** What it is waiting for, if blocked (a row lock, or a condition). */
  waitingOn?: string;
}

export interface RowFrame {
  /** Column/row key, e.g. "alice". */
  key: string;
  /** The durable, committed value every transaction may read. */
  committed: number;
  /**
   * Uncommitted writes, by transaction id. Present only until commit or abort —
   * this is the value a dirty read sees and a rollback erases.
   */
  pending: Record<string, number>;
  /** Transaction currently holding this row's write lock, if any. */
  lockedBy?: string;
}

export interface TableState {
  rows: RowFrame[];
  txns: TxnFrame[];
  /** Transaction that produced this frame; null on the first. */
  active: string | null;
  /** The statement that just ran. */
  ranStatement?: string;
  /** Isolation level in force, shown as the plate's subject. */
  isolation: string;
  /**
   * Set when a transaction has read a value that was never committed — the
   * anomaly the lesson exists to make visible, recorded rather than inferred so
   * the view can mark it and a test can assert it.
   */
  anomaly?: string;
}
