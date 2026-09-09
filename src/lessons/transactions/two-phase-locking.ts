import {
  TXN_COUNTERS,
  runTransactions,
  type TxnProgram,
} from "@/engine/algo/transactions";
import type { AlgoDef } from "@/engine/algo/types";
import type { TableState } from "@/engine/algo/views/table";

/**
 * Two-Phase Locking — archetype B (`engine: "steps"`).
 *
 * The question the last two lessons leave hanging: serializable refused a commit,
 * so why not just make the second transaction WAIT?
 *
 * It can. That is two-phase locking, and it reaches the same guarantee by the
 * opposite route — pessimistic instead of optimistic. Both figures here run the
 * lost-update program at serializable; the only difference is the mechanism.
 *
 * `SELECT … FOR UPDATE` is modelled by declaring `locks` on the read statement:
 * the read takes the row exclusively and holds it to the end, so a second
 * transaction cannot even read until the first commits. That is why 2PL gets 120
 * without a retry, and why the second transaction spends the run waiting.
 */

const CODE = [
  "SELECT ... FOR UPDATE",
  "compute new value",
  "write balance",
  "COMMIT",
];

function adjust(id: string, name: string, delta: number) {
  return {
    id,
    name,
    statements: [
      {
        label: "read balance",
        codeLine: 0,
        // The lock is taken HERE, at the read, not at the write. Taking it at the
        // write would be too late: the value it computed from could already have
        // moved, which is the lost update all over again.
        locks: ["balance"],
        run: (ctx: { read: (r: string) => number }) => {
          ctx.read("balance");
        },
      },
      {
        label: `balance ${delta > 0 ? "+" : "-"} ${Math.abs(delta)}`,
        codeLine: 2,
        locks: ["balance"],
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

function program(mechanism: "snapshot" | "2pl"): TxnProgram {
  return {
    rows: { balance: 100 },
    txns: [
      adjust("T1", "T1 · deposit 50", 50),
      adjust("T2", "T2 · withdraw 30", -30),
    ],
    isolation: "serializable",
    mechanism,
  };
}

const counters = [
  { key: TXN_COUNTERS.statements, label: "statements" },
  { key: TXN_COUNTERS.conflicts, label: "commits refused" },
];

/** Optimistic: read a snapshot, discover the conflict at commit, fail. */
export const optimisticAlgo: AlgoDef<TableState, TxnProgram> = {
  id: "two-phase-locking-optimistic",
  title: "optimistic",
  code: CODE,
  counters,
  generateInput: () => program("snapshot"),
  run: (input, rng) => runTransactions(input, rng),
};

/** Pessimistic: take the lock at the read, and make the other one wait. */
export const twoPhaseLockingAlgo: AlgoDef<TableState, TxnProgram> = {
  id: "two-phase-locking",
  title: "two-phase locking",
  code: CODE,
  counters,
  generateInput: () => program("2pl"),
  run: (input, rng) => runTransactions(input, rng),
};
