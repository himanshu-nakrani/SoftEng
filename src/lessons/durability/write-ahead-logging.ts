import type { AlgoDef } from "@/engine/algo/types";
import { WAL_COUNTERS, runWal, type WalPolicy, type WalScript } from "@/engine/algo/wal";
import type { WalState } from "@/engine/algo/views/wal";

/**
 * Write-Ahead Logging — archetype B (`engine: "steps"`).
 *
 * The transaction lessons all assumed a commit was the end of the story. It is
 * not: a commit is a PROMISE, and a promise has to survive losing power. This
 * lesson is about the cheapest honest way to keep it.
 *
 * Both figures run the same eight operations on the same two pages. T1 changes
 * both pages and commits; T2 then starts changing one of them and never
 * finishes. The only difference between the figures is whether a log exists.
 *
 * THE CONTROL IS THE CRASH POINT. The size slider is not a size — it is how many
 * operations run before the power fails. Every value is a different crash, which
 * is the only way to show that durability is a claim about ALL of them and not
 * about the convenient one. Measured across all nine: the no-log policy loses
 * acknowledged work at six of them, in three distinct shapes; write-ahead
 * logging loses it at none.
 *
 * MODELLING NOTE, and its limits. The model is a buffer pool, a log with a
 * forced prefix, and pages on disk; a crash discards the pool and the unforced
 * tail, and nothing else. Deliberately absent: group commit, partial page
 * writes, and torn sectors. Those change how expensive the fsync is and how
 * paranoid recovery must be — they do not change the argument, which is that one
 * sequential force can make any number of scattered pages recoverable.
 */

/**
 * T1 spans two pages, which is what makes the failure interesting: no single
 * page write can make a two-page transaction atomic, so "flush the pages you
 * changed" is not a fix even in principle.
 *
 * T2 exists to give recovery something to UNDO. Without it the lesson would only
 * show redo, and the write-ahead rule would look like bureaucracy.
 */
const OPS: WalScript["ops"] = [
  { kind: "write", txn: "T1", page: "balance", value: 150 },
  { kind: "write", txn: "T1", page: "audit", value: 1 },
  { kind: "commit", txn: "T1" },
  { kind: "flush", page: "balance" },
  { kind: "write", txn: "T2", page: "balance", value: 90 },
  { kind: "flush", page: "balance" },
  { kind: "checkpoint" },
  { kind: "write", txn: "T2", page: "audit", value: 2 },
];

function script(policy: WalPolicy, crashAfter: number): WalScript {
  return {
    pages: { balance: 100, audit: 0 },
    txns: [
      { id: "T1", name: "T1 · transfer" },
      { id: "T2", name: "T2 · adjustment" },
    ],
    ops: OPS,
    crashAfter,
    policy,
  };
}

/**
 * The crash point, exposed as the figure's one slider.
 *
 * The range stops one short of the script deliberately: every position must be a
 * real power failure. Letting the run finish would leave T2 in flight, and
 * "what should be on disk" is not defined for a transaction that has neither
 * committed nor rolled back — the figure would be asserting a verdict it has no
 * standing to give.
 */
const crashControl = {
  label: "operations before the crash",
  min: 0,
  max: OPS.length - 1,
  default: 4,
};

/**
 * Same four counters on both figures, deliberately: the contrast is meant to be
 * readable in the meters, not only in the prose. The no-log run sits at zero log
 * records and zero forces for its whole life.
 */
const counters = [
  { key: WAL_COUNTERS.logRecords, label: "log records" },
  { key: WAL_COUNTERS.fsyncs, label: "log forces" },
  { key: WAL_COUNTERS.pageWrites, label: "page writes" },
  { key: WAL_COUNTERS.repaired, label: "records applied" },
];

/** No log: the pages on disk are the only durable state there is. */
export const pagesOnlyAlgo: AlgoDef<WalState, WalScript> = {
  id: "write-ahead-logging-pages-only",
  title: "pages only",
  code: [
    "write page in pool",
    "(nothing is logged)",
    "COMMIT -> report ok",
    "(nothing is forced)",
    "flush page to disk",
    "-- power fails --",
    "restart: no log",
    "(nothing to undo)",
  ],
  counters,
  size: crashControl,
  generateInput: (_rng, size) => script("pages-only", size),
  run: (input) => runWal(input),
};

/** A log, appended before the change and forced at commit. */
export const writeAheadLoggingAlgo: AlgoDef<WalState, WalScript> = {
  id: "write-ahead-logging",
  title: "write-ahead log",
  code: [
    "write page in pool",
    "log the change first",
    "COMMIT",
    "fsync log, not pages",
    "flush page to disk",
    "-- power fails --",
    "redo committed",
    "undo uncommitted",
  ],
  counters,
  size: crashControl,
  generateInput: (_rng, size) => script("write-ahead", size),
  // No `rng`: a power failure is the reader's choice here, not a random event.
  run: (input) => runWal(input),
};
