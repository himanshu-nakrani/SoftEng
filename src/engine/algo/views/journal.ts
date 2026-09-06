/**
 * FS journal view — data blocks, inode names, and an optional journal.
 *
 * Same durability-divide idea as WAL, reduced to one file create: a data
 * block on disk that the inode does not name is an orphan.
 */

export type JournalPhase = "run" | "crash" | "recover" | "done";

export interface JournalRecord {
  inode: string;
  block: number;
  forced: boolean;
}

export interface JournalState {
  policy: "unordered" | "journal";
  dataOnDisk: number[];
  inodeOnDisk: number[];
  journal: JournalRecord[];
  forcedUpTo: number;
  phase: JournalPhase;
  last?: { kind: "data" | "meta" | "jwrite" | "jforce" | "crash"; block?: number };
  orphan: boolean;
  stamp: string;
}
