import {
  TXN_COUNTERS,
  runTransactions,
  type Isolation,
  type TxnProgram,
} from "@/engine/algo/transactions";
import type { AlgoDef } from "@/engine/algo/types";
import type { TableState } from "@/engine/algo/views/table";

/**
 * Non-Repeatable Reads — archetype B (`engine: "steps"`).
 *
 * The anomaly the previous lesson's closing warning set up. Read committed
 * guarantees every read returns COMMITTED data; it does not guarantee that two
 * reads in one transaction return data that was committed at the same MOMENT.
 *
 * Here T1 reads alice, then bob, and totals them. T2 transfers 50 between them
 * and commits successfully — no rollback, nothing dirty, no bug in either
 * transaction. If T2 commits between T1's two reads, T1 sees alice before and bob
 * after, and totals a pair of values that were never simultaneously true.
 *
 * That is the hard part to accept: every individual value T1 read was committed.
 * The report is still wrong.
 */

const CODE = [
  "T1: read alice",
  "T1: read bob",
  "T1: report total",
  "T2: alice -= 50",
  "T2: bob += 50",
  "T2: COMMIT",
];

const reader = {
  id: "T1",
  name: "T1 · report",
  statements: [
    {
      label: "read alice",
      codeLine: 0,
      run: (ctx: { read: (r: string) => number }) => {
        ctx.read("alice");
      },
    },
    {
      label: "read bob",
      codeLine: 1,
      run: (ctx: { read: (r: string) => number }) => {
        ctx.read("bob");
      },
    },
    {
      label: "report total",
      codeLine: 2,
      commit: true,
      run: (ctx: { seen: Record<string, number>; write: (r: string, v: number) => void }) => {
        ctx.write("total", (ctx.seen.alice ?? 0) + (ctx.seen.bob ?? 0));
      },
    },
  ],
};

/** A transfer that SUCCEEDS. Nothing here is faulty; that is the point. */
const transfer = {
  id: "T2",
  name: "T2 · transfer",
  statements: [
    {
      label: "alice -= 50",
      codeLine: 3,
      run: (ctx: { read: (r: string) => number; write: (r: string, v: number) => void }) => {
        ctx.write("alice", ctx.read("alice") - 50);
      },
    },
    {
      label: "bob += 50",
      codeLine: 4,
      run: (ctx: { read: (r: string) => number; write: (r: string, v: number) => void }) => {
        ctx.write("bob", ctx.read("bob") + 50);
      },
    },
    { label: "COMMIT", codeLine: 5, commit: true },
  ],
};

function program(isolation: Isolation): TxnProgram {
  return {
    rows: { alice: 100, bob: 100, total: 200 },
    txns: [reader, transfer],
    isolation,
  };
}

const counters = [
  { key: TXN_COUNTERS.statements, label: "statements" },
  { key: TXN_COUNTERS.dirtyReads, label: "dirty reads" },
];

/** Read committed: each read is of committed data, and the total can still be wrong. */
export const nonRepeatableAlgo: AlgoDef<TableState, TxnProgram> = {
  id: "non-repeatable-reads",
  title: "read committed",
  code: CODE,
  counters,
  generateInput: () => program("read committed"),
  run: (input, rng) => runTransactions(input, rng),
};

/** Repeatable read: T1 answers every read from the snapshot it began with. */
export const repeatableReadAlgo: AlgoDef<TableState, TxnProgram> = {
  id: "non-repeatable-reads-snapshot",
  title: "repeatable read",
  code: CODE,
  counters,
  generateInput: () => program("repeatable read"),
  run: (input, rng) => runTransactions(input, rng),
};
