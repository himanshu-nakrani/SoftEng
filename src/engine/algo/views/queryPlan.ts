/**
 * The query-plan view's state contract — archetype B, for index vs scan.
 *
 * Pure data (no JSX) so a lesson `.ts` file can model access-path cost without
 * pulling a component into its module graph.
 *
 * WHY A SEPARATE VIEW rather than reusing `StorageView`. Storage compares two
 * engines writing the same keys. This lesson compares three READ paths over
 * one heap: a table scan that reads every page, a clustered seek that reads
 * contiguous matching leaves, and a secondary index that pays a random heap
 * fetch per match. The subject is the tipping point where bookmarks cost more
 * than the scan, which a storage-engine diagram cannot show.
 */

export type AccessPath = "scan" | "clustered" | "secondary";

export interface HeapPage {
  id: string;
  rows: number;
  matches: number;
  /** This heap page was read on this frame. */
  read: boolean;
  /** A secondary-index bookmark landed here on this frame. */
  bookmark: boolean;
}

export interface IndexNode {
  id: string;
  kind: "root" | "leaf";
  active: boolean;
}

export interface QueryPlanState {
  path: AccessPath;
  heap: HeapPage[];
  index: IndexNode[];
  matches: number;
  examined: number;
  stamp: string;
}
