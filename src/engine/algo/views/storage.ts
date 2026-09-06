/**
 * The storage-engine view's state contract — archetype B, for B-tree vs LSM.
 *
 * Pure data (no JSX) so a lesson `.ts` file can model write/read amplification
 * without pulling a component into its module graph.
 *
 * WHY A SEPARATE VIEW rather than reusing `WalView`. WAL splits ONE log across a
 * durability line. This lesson compares TWO engines: a B-tree that rewrites a
 * leaf in place, and an LSM that appends to a memtable and later flushes. The
 * subject is amplification (how many pages a logical write or read touches),
 * not what survives a crash, so the composition is the live pages of whichever
 * engine is running, not a volatile/durable divide.
 */

export type StorageEngine = "btree" | "lsm";

export type StorageOpKind = "write" | "read" | "flush" | "compact";

export interface StoragePage {
  id: string;
  /** Keys currently stored on this page, oldest-insert first. */
  keys: string[];
  kind: "root" | "leaf" | "memtable" | "sstable";
  /** This page was touched by the op that produced this frame. */
  active: boolean;
  /**
   * A read probed this SSTable's bloom filter and skipped it — the key cannot
   * be here. Distinct from "not active": a skip is a measured miss, not silence.
   */
  bloomSkip: boolean;
}

export interface StorageState {
  engine: StorageEngine;
  pages: StoragePage[];
  lastOp?: { kind: StorageOpKind; key?: string };
  /** Set on a read frame: whether the key was found. */
  found?: boolean;
  /**
   * Glanceable verdict. The caption is the prose; this is the number the
   * reader should be able to check against the meters without reading it twice.
   */
  stamp: string;
}
