import type { AlgoDef } from "@/engine/algo/types";
import { WAL_COUNTERS, runWal, type WalScript } from "@/engine/algo/wal";
import type { WalState } from "@/engine/algo/views/wal";

/**
 * Group Commit — archetype B (`engine: "steps"`), reusing `runWal`.
 *
 * Write-Ahead Logging established that a commit costs one sequential force. This
 * lesson asks the obvious follow-up: at ten thousand commits a second, is it one
 * force EACH?
 *
 * It need not be. Commit records are appended to the same log, so a single fsync
 * can make several of them durable at once — and every transaction in the batch
 * is answered by that one write. The cost is not safety. It is that each
 * transaction now waits for the batch, so the ones that were ready early are held
 * for the ones that were not.
 *
 * THE MISCONCEPTION THIS EXISTS TO KILL is that grouping is a durability
 * compromise. It is not, and the figures show why: a transaction whose commit
 * record has been appended but not forced has NOT been acknowledged, so a crash
 * there costs nothing. Nobody was told anything. What grouping trades is LATENCY,
 * and the run makes that trade visible as a state — three transactions sitting in
 * `committing`, logically finished and unanswered.
 *
 * Both figures run the same eight operations. Batching is a policy on the script,
 * so "crash after four" means identical work in each.
 */
const OPS: WalScript["ops"] = [
  { kind: "write", txn: "T1", page: "orders", value: 1 },
  { kind: "commit", txn: "T1" },
  { kind: "write", txn: "T2", page: "stock", value: 19 },
  { kind: "commit", txn: "T2" },
  { kind: "write", txn: "T3", page: "ledger", value: 5 },
  { kind: "commit", txn: "T3" },
  // The batch force. Taken by one figure; the other has nothing left to force
  // because it forced at every commit.
  { kind: "groupFlush" },
  // One op after the batch, so the last crash point lands AFTER it. Without a
  // trailing operation the slider could never reach a crash that follows the
  // force, and the grouped run would look like it never answered anybody.
  { kind: "flush", page: "orders" },
];

function script(
  commitPolicy: "per-commit" | "grouped",
  crashAfter: number,
): WalScript {
  return {
    pages: { orders: 0, stock: 20, ledger: 0 },
    txns: [
      { id: "T1", name: "T1 · order" },
      { id: "T2", name: "T2 · stock" },
      { id: "T3", name: "T3 · ledger" },
    ],
    ops: OPS,
    crashAfter,
    policy: "write-ahead",
    commitPolicy,
  };
}

const crashControl = {
  label: "operations before the crash",
  min: 0,
  max: OPS.length - 1,
  default: 6,
};

/**
 * `fsyncs` first: it is the number the whole lesson is about. `logRecords` shows
 * that the batch appended exactly as much as the other run did — the saving is
 * in forces, not in log volume.
 */
const counters = [
  { key: WAL_COUNTERS.fsyncs, label: "log forces" },
  { key: WAL_COUNTERS.logRecords, label: "log records" },
  { key: WAL_COUNTERS.pageWrites, label: "page writes" },
  { key: WAL_COUNTERS.repaired, label: "records applied" },
];

const CODE = [
  "write page in pool",
  "log the change first",
  "COMMIT",
  "fsync, then answer",
  "flush page to disk",
  "-- power fails --",
  "redo committed",
  "undo uncommitted",
];

/** One fsync per commit. Answers immediately, pays every time. */
export const perCommitAlgo: AlgoDef<WalState, WalScript> = {
  id: "group-commit-per-commit",
  title: "force at every commit",
  code: CODE,
  counters,
  size: crashControl,
  generateInput: (_rng, size) => script("per-commit", size),
  run: (input) => runWal(input),
};

/** One fsync for the batch. Pays once, answers late. */
export const groupCommitAlgo: AlgoDef<WalState, WalScript> = {
  id: "group-commit",
  title: "one force for the batch",
  code: CODE,
  counters,
  size: crashControl,
  generateInput: (_rng, size) => script("grouped", size),
  run: (input) => runWal(input),
};
