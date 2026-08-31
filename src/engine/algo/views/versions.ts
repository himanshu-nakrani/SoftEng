/**
 * The version-chain view's state contract — archetype B, for the MVCC lesson.
 *
 * Pure data (no JSX) so a lesson `.ts` file can model multi-version concurrency
 * control without pulling a component into its module graph.
 *
 * WHY A SEPARATE VIEW rather than reusing `TableView`. `TableView` splits a row
 * into ONE committed value and a set of pending writes, which is exactly the
 * black box the isolation lessons stand on: it shows THAT a snapshot read
 * happened, never WHERE the value it returned still lives. MVCC's whole subject
 * is that a row is not one cell but a CHAIN of versions, and an old one stays
 * readable — by a transaction whose snapshot predates the newer one — precisely
 * because the newer one did not overwrite it. A single committed cell cannot
 * draw that; a chain per row can.
 */

export type MvccTxnStatus = "idle" | "active" | "committed" | "aborted";

export interface VersionFrame {
  /** Row this version belongs to. */
  row: string;
  /** The value this version holds. */
  value: number;
  /** Transaction that created it. */
  createdBy: string;
  /**
   * The writer's start timestamp — the version's birth order. Two versions of
   * the same row are ordered by this, newest last.
   */
  beginTs: number;
  /**
   * The commit timestamp, set when the creating transaction commits. Undefined
   * while the version is still uncommitted (visible only to its own writer).
   */
  commitTs?: number;
  /** True once the creating transaction has committed. */
  committed: boolean;
  /** True if the creating transaction rolled back — the version is dead. */
  aborted: boolean;
  /** This version was touched by the statement that produced this frame. */
  active: boolean;
  /**
   * A reader picked THIS version as the one its snapshot can see, on this frame.
   * The point of the whole view: which version a snapshot reads.
   */
  readNow: boolean;
}

export interface MvccTxnFrame {
  id: string;
  /** Display name, e.g. "T1 · report". */
  name: string;
  status: MvccTxnStatus;
  /**
   * The snapshot timestamp this transaction reads at — taken at its first
   * statement, so it cannot see anything committed afterwards. Undefined before
   * it begins.
   */
  startTs?: number;
  /** What it has read so far, for showing which version it saw. */
  seen: Record<string, number>;
  /** The statement it is about to run, or undefined when finished. */
  next?: string;
}

export interface MvccRowFrame {
  key: string;
  /** Every version of this row, oldest first. */
  versions: VersionFrame[];
}

export interface VersionsState {
  rows: MvccRowFrame[];
  txns: MvccTxnFrame[];
  /** Transaction that produced this frame; null on the first. */
  active: string | null;
  /** The statement that just ran. */
  ranStatement?: string;
  /** The logical clock, shown so the reader can order snapshots against commits. */
  clock: number;
  /**
   * Set when a transaction read an OLD version because a newer committed one is
   * invisible to its snapshot — the mechanism the lesson exists to show,
   * recorded rather than inferred so the view can mark it and a test can assert
   * it.
   */
  snapshotNote?: string;
  /**
   * Set when a write is refused because another transaction already committed a
   * newer version of the same row — first-committer-wins, the write-write
   * conflict MVCC still has to detect.
   */
  conflict?: string;
}
