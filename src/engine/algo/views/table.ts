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

export interface TxnFrame<V = number> {
  id: string;
  /** Display name, e.g. "T1 · transfer". */
  name: string;
  status: TxnStatus;
  /** What this transaction has read so far, for showing a stale read. */
  seen: Record<string, V>;
  /** The statement it is about to run, or undefined when finished. */
  next?: string;
  /** What it is waiting for, if blocked (a row lock, or a condition). */
  waitingOn?: string;
}

export interface TableColumn {
  key: string;
  label: string;
  width?: number;
}

export interface PackageCoupling {
  name: string;
  ca: number;
  ce: number;
  total: number;
}

export interface RowFrame<V = number> {
  /** Column/row key, e.g. "alice" or package name. */
  key: string;
  /** The durable, committed value every transaction may read. */
  committed: V;
  /**
   * Uncommitted writes, by transaction id. Present only until commit or abort —
   * this is the value a dirty read sees and a rollback erases.
   */
  pending: Record<string, V>;
  /** Transaction currently holding this row's write lock, if any. */
  lockedBy?: string;
  /** Arbitrary column values for structured multi-column table views. */
  values?: Record<string, number | string>;
}

export interface TableState<V = number> {
  columns?: TableColumn[];
  rows: RowFrame<V>[];
  txns: TxnFrame<V>[];
  /** Transaction or package that produced this frame; null on the first. */
  active: string | null;
  /** The statement or action that just ran. */
  ranStatement?: string;
  /** Table title or isolation level in force, shown as the plate's subject. */
  isolation: string;
  /**
   * Set when an anomaly is observed or a refactoring metric banner is shown.
   */
  anomaly?: string;
  /** Package coupling metrics snapshot if modeling modularity. */
  packages?: PackageCoupling[];
}

/** One package's architectural metrics row in the package-metrics table view. */
export interface PackageMetricRow {
  /** Package name, e.g. "core", "web-api". */
  name: string;
  /** Afferent coupling: incoming dependencies. */
  ca: number;
  /** Efferent coupling: outgoing dependencies. */
  ce: number;
  /** Instability I = Ce / (Ca + Ce), in [0, 1]. */
  i: number;
  /** Abstractness A = Na / Nc, in [0, 1]. */
  a: number;
  /** Distance from Main Sequence D = |A + I - 1|, in [0, 1]. */
  d: number;
  /** Architectural zone classification. */
  zone?: string;
  /** Whether this package is the active subject of the current step. */
  highlight?: boolean;
}

/** State contract for package coupling and instability/abstractness metrics table. */
export interface PackageTableState {
  kind: "package-metrics";
  /** Rows representing packages in the analysed system. */
  packages: PackageMetricRow[];
  /** Optional caption or note explaining current step change. */
  caption?: string;
  /** Package name currently focused or refactored. */
  highlightPackage?: string;
}

export type TableViewState = TableState<number | string> | PackageTableState;

export function isPackageTableState(state: unknown): state is PackageTableState {
  return Boolean(
    state &&
      typeof state === "object" &&
      ("packages" in (state as Record<string, unknown>) ||
        (state as Record<string, unknown>).kind === "package-metrics"),
  );
}
