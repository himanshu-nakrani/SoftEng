import {
  TXN_COUNTERS,
  runTransactions,
  type Isolation,
  type TxnProgram,
} from "@/engine/algo/transactions";
import type { AlgoDef } from "@/engine/algo/types";
import type { TableState } from "@/engine/algo/views/table";

/**
 * Lost Update — archetype B (`engine: "steps"`).
 *
 * The oldest anomaly in the set, and the one that looks most like a bug in your
 * code until you realise it is not. Two transactions read the same balance,
 * each computes a new value from what it read, and each writes it back. Both
 * commit. One update is simply gone.
 *
 * The distinction from write skew is worth being precise about: here both
 * transactions write the SAME row, so the second write overwrites the first. That
 * makes it detectable by a mechanism that only watches writes — which is why
 * databases offer cheap fixes for it (`SELECT … FOR UPDATE`, an atomic `UPDATE`)
 * that do nothing for write skew.
 *
 * `data-races` in track 02 is the same shape one layer down: read, modify, write,
 * with a scheduler free to cut between. A transaction is not a smaller window —
 * it is a much larger one.
 */

const CODE = [
  "read balance",
  "compute new value",
  "write balance",
  "COMMIT",
];

/** One transaction adjusting the balance by `delta`, based on what it read. */
function adjust(id: string, name: string, delta: number) {
  return {
    id,
    name,
    statements: [
      {
        label: "read balance",
        codeLine: 0,
        run: (ctx: { read: (r: string) => number }) => {
          ctx.read("balance");
        },
      },
      {
        label: `balance ${delta > 0 ? "+" : "-"} ${Math.abs(delta)}`,
        codeLine: 2,
        run: (ctx: {
          seen: Record<string, number>;
          write: (r: string, v: number) => void;
        }) => {
          ctx.write("balance", (ctx.seen.balance ?? 0) + delta);
        },
      },
      { label: "COMMIT", codeLine: 3, commit: true },
    ],
  };
}

function program(isolation: Isolation): TxnProgram {
  return {
    rows: { balance: 100 },
    txns: [
      adjust("T1", "T1 · deposit 50", 50),
      adjust("T2", "T2 · withdraw 30", -30),
    ],
    isolation,
  };
}

const counters = [
  { key: TXN_COUNTERS.statements, label: "statements" },
  { key: TXN_COUNTERS.conflicts, label: "commits refused" },
];

/** Read committed: whoever writes last wins, and the other update vanishes. */
export const lostUpdateAlgo: AlgoDef<TableState, TxnProgram> = {
  id: "lost-update",
  title: "read committed",
  code: CODE,
  counters,
  generateInput: () => program("read committed"),
  run: (input, rng) => runTransactions(input, rng),
};

/** Serializable: the second commit is refused, because the balance it read moved. */
export const lostUpdateSerializableAlgo: AlgoDef<TableState, TxnProgram> = {
  id: "lost-update-serializable",
  title: "serializable",
  code: CODE,
  counters,
  generateInput: () => program("serializable"),
  run: (input, rng) => runTransactions(input, rng),
};
