import type { AlgoDef } from "@/engine/algo/types";
import { WAL_COUNTERS, runWal, type WalScript } from "@/engine/algo/wal";
import type { WalState } from "@/engine/algo/views/wal";

/**
 * Checkpoints — archetype B (`engine: "steps"`), reusing `runWal`.
 *
 * The previous lesson left two things unfinished. The log grows forever, and
 * recovery replays it from the beginning — so a database that has been up for a
 * month would take a month to restart. Both are answered by the same operation,
 * which that lesson's own script quietly performed without explaining.
 *
 * A checkpoint forces every dirty page to disk and records that it did so. After
 * that, no record older than the checkpoint has anything left to replay, so redo
 * may START there. That is the whole benefit, and it is worth being precise about
 * what it is NOT: the checkpoint does not make the repair smaller. It makes the
 * part of the log that still matters shorter.
 *
 * BOTH FIGURES RUN THE SAME TEN OPERATIONS. Checkpointing is a policy on the
 * script, not a different script, so "crash after six" means the identical
 * workload in both — the only difference is whether the opportunity at op 5 was
 * taken. T4 is left uncommitted on purpose: it gives undo something to do, which
 * is how the lesson can show that the two recovery passes do not share a bound.
 */
const OPS: WalScript["ops"] = [
  { kind: "write", txn: "T1", page: "orders", value: 1 },
  { kind: "write", txn: "T1", page: "stock", value: 19 },
  { kind: "commit", txn: "T1" },
  // T4 starts here and never commits. Its position matters: it dirties a page
  // BEFORE the checkpoint, so a checkpoint that forces every dirty page forces
  // this uncommitted one too — which is the reason undo cannot start where redo
  // does.
  { kind: "write", txn: "T4", page: "ledger", value: 9 },
  // The checkpoint OPPORTUNITY. Taken by one figure, declined by the other.
  { kind: "checkpoint" },
  { kind: "write", txn: "T2", page: "orders", value: 2 },
  { kind: "commit", txn: "T2" },
  { kind: "write", txn: "T3", page: "stock", value: 18 },
  { kind: "commit", txn: "T3" },
  { kind: "write", txn: "T4", page: "orders", value: 7 },
];

function script(checkpoints: boolean, crashAfter: number): WalScript {
  return {
    pages: { orders: 0, stock: 20, ledger: 0 },
    txns: [
      { id: "T1", name: "T1 · restock" },
      { id: "T2", name: "T2 · new order" },
      { id: "T3", name: "T3 · shipment" },
      { id: "T4", name: "T4 · adjustment" },
    ],
    ops: OPS,
    crashAfter,
    policy: "write-ahead",
    checkpoints,
  };
}

/**
 * Stops one short of the script for the same reason the WAL lesson's does: every
 * position must be a real power failure, and letting the run finish would leave
 * T4 in flight with no defensible verdict.
 */
const crashControl = {
  label: "operations before the crash",
  min: 0,
  max: OPS.length - 1,
  default: 9,
};

/**
 * `scanned` first, because it is the number the checkpoint is responsible for.
 * `pageWrites` and `fsyncs` are what it costs to get it.
 */
const counters = [
  { key: WAL_COUNTERS.scanned, label: "redo scanned" },
  { key: WAL_COUNTERS.repaired, label: "records applied" },
  { key: WAL_COUNTERS.pageWrites, label: "page writes" },
  { key: WAL_COUNTERS.fsyncs, label: "log forces" },
];

const CODE = [
  "write page in pool",
  "log the change first",
  "COMMIT",
  "fsync log, not pages",
  "checkpoint: force all",
  "-- power fails --",
  "redo from checkpoint",
  "undo uncommitted",
];

/** The opportunity declined: nothing is forced until the crash. */
export const noCheckpointAlgo: AlgoDef<WalState, WalScript> = {
  id: "checkpoints-none",
  title: "no checkpoint",
  code: CODE,
  counters,
  size: crashControl,
  generateInput: (_rng, size) => script(false, size),
  run: (input) => runWal(input),
};

/** The opportunity taken: dirty pages forced, and redo gets a floor. */
export const checkpointsAlgo: AlgoDef<WalState, WalScript> = {
  id: "checkpoints",
  title: "one checkpoint",
  code: CODE,
  counters,
  size: crashControl,
  generateInput: (_rng, size) => script(true, size),
  run: (input) => runWal(input),
};
