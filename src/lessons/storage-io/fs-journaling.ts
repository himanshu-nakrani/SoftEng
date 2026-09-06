import {
  JOURNAL_COUNTERS,
  runJournal,
  type JournalConfig,
  type JournalOp,
  type JournalPolicy,
} from "@/engine/algo/journal";
import type { AlgoDef } from "@/engine/algo/types";
import type { JournalState } from "@/engine/algo/views/journal";

/**
 * File System Journaling — archetype B (`engine: "steps"`).
 *
 * Creating a file is two disk writes: the data block, then the inode that
 * names it. A crash between them, with no journal, leaves the block on disk
 * and the inode empty — an orphan. A metadata journal appends the inode
 * change and forces it before the inode itself is written, so a crash after
 * the force is still recoverable. The data block is written in place either
 * way. This is WAL's ordering rule applied to an inode.
 *
 * Both figures create the same one-block file. Unordered ops are data then
 * inode. Journaled ops are data, jwrite, jforce, then inode. THE CONTROL IS
 * THE CRASH POINT. Measured: unordered crash 1 orphans (data [0], inode []);
 * crash 2 is consistent. Journal crash 3 — after the force, before the inode
 * write — recovers: orphan false, inode [0]. Crash 2 still orphans, because
 * an unforced record is not durable. Crash 1 still orphans, because the
 * data was never in the journal.
 *
 * MODELLING NOTE, and its limits. One file, one block, metadata journaling
 * only. Deliberately absent: data journaling, checksums, delayed allocation,
 * and the reverse gap (inode written first, pointing at leftover bytes).
 * The figure writes data first so the crash it shows is the orphan, not a
 * corrupt name.
 */

const UNORDERED_OPS: JournalOp[] = [
  { kind: "data", block: 0 },
  { kind: "meta", inode: "file", block: 0 },
];

const JOURNALED_OPS: JournalOp[] = [
  { kind: "data", block: 0 },
  { kind: "jwrite", inode: "file", block: 0 },
  { kind: "jforce" },
  { kind: "meta", inode: "file", block: 0 },
];

function cfg(
  policy: JournalPolicy,
  ops: JournalOp[],
  crashAfter: number,
): JournalConfig {
  return { policy, ops, crashAfter };
}

const counters = [
  { key: JOURNAL_COUNTERS.dataWrites, label: "data writes" },
  { key: JOURNAL_COUNTERS.metaWrites, label: "inode writes" },
  { key: JOURNAL_COUNTERS.journalWrites, label: "journal writes" },
  { key: JOURNAL_COUNTERS.forces, label: "journal forces" },
];

const UNORDERED_CODE = [
  "write data block",
  "write inode",
  "(no journal)",
  "(no force)",
  "-- power fails --",
  "(no replay)",
];

const JOURNALED_CODE = [
  "write data block",
  "write inode",
  "log the inode first",
  "force the journal",
  "-- power fails --",
  "replay journal",
];

/** No journal: data block, then inode. A crash between them orphans the block. */
export const fsJournalingUnorderedAlgo: AlgoDef<JournalState, JournalConfig> = {
  id: "fs-journaling-unordered",
  title: "unordered",
  code: UNORDERED_CODE,
  counters,
  size: {
    label: "operations before the crash",
    min: 0,
    max: 2,
    default: 1,
  },
  generateInput: (_rng, size) => cfg("unordered", UNORDERED_OPS, size),
  run: (input) => runJournal(input),
};

/** Metadata journal: force the inode change before writing the inode. */
export const fsJournalingAlgo: AlgoDef<JournalState, JournalConfig> = {
  id: "fs-journaling",
  title: "journaled",
  code: JOURNALED_CODE,
  counters,
  size: {
    label: "operations before the crash",
    min: 0,
    max: 4,
    default: 3,
  },
  generateInput: (_rng, size) => cfg("journal", JOURNALED_OPS, size),
  run: (input) => runJournal(input),
};
