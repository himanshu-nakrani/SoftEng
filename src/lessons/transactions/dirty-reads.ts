import {
  TXN_COUNTERS,
  runTransactions,
  type Isolation,
  type TxnProgram,
} from "@/engine/algo/transactions";
import type { AlgoDef } from "@/engine/algo/types";
import type { TableState } from "@/engine/algo/views/table";

/**
 * Dirty Reads and Read Committed — archetype B (`engine: "steps"`).
 *
 * Two transactions over two rows. T1 moves 50 from alice to bob and then hits an
 * error and rolls back; T2 reports the total. Under `read uncommitted` T2 can see
 * T1's half-finished writes, so it can report a total that no transaction ever
 * committed — and once T1 aborts, a total that never existed at any moment.
 *
 * The isolation rule is not asserted anywhere in the prose: it lives in
 * `visibleTo` in the step producer, so the anomaly is something the run
 * demonstrates. The same program at `read committed` cannot produce it.
 *
 * Both accounts hold 100, so the invariant is simple enough to hold in your head:
 * the total is always 200 unless somebody is lying to you.
 */

const CODE = [
  "T1: alice -= 50",
  "T1: bob += 50",
  "T1: ROLLBACK",
  "T2: read alice",
  "T2: read bob",
  "T2: report total",
];

/** The transfer that fails: two writes, then a rollback. */
const transfer = {
  id: "T1",
  name: "T1 · transfer",
  statements: [
    {
      label: "alice -= 50",
      codeLine: 0,
      run: (ctx: { read: (r: string) => number; write: (r: string, v: number) => void }) => {
        ctx.write("alice", ctx.read("alice") - 50);
      },
    },
    {
      label: "bob += 50",
      codeLine: 1,
      run: (ctx: { read: (r: string) => number; write: (r: string, v: number) => void }) => {
        ctx.write("bob", ctx.read("bob") + 50);
      },
    },
    {
      // Constraint violation, deadlock victim, application error — the reason does
      // not matter. What matters is that everything above must un-happen.
      label: "ROLLBACK",
      codeLine: 2,
      run: () => "abort" as const,
    },
  ],
};

/** The reporter: reads both rows and totals them. */
const report = {
  id: "T2",
  name: "T2 · report",
  statements: [
    {
      label: "read alice",
      codeLine: 3,
      run: (ctx: { read: (r: string) => number }) => {
        ctx.read("alice");
      },
    },
    {
      label: "read bob",
      codeLine: 4,
      run: (ctx: { read: (r: string) => number }) => {
        ctx.read("bob");
      },
    },
    {
      label: "report total",
      codeLine: 5,
      commit: true,
      run: (ctx: { seen: Record<string, number>; write: (r: string, v: number) => void }) => {
        ctx.write("total", (ctx.seen.alice ?? 0) + (ctx.seen.bob ?? 0));
      },
    },
  ],
};

function program(isolation: Isolation): TxnProgram {
  return {
    rows: { alice: 100, bob: 100, total: 200 },
    txns: [transfer, report],
    isolation,
  };
}

const counters = [
  { key: TXN_COUNTERS.statements, label: "statements" },
  { key: TXN_COUNTERS.dirtyReads, label: "dirty reads" },
];

export const dirtyReadAlgo: AlgoDef<TableState, TxnProgram> = {
  id: "dirty-reads",
  title: "read uncommitted",
  code: CODE,
  counters,
  generateInput: () => program("read uncommitted"),
  run: (input, rng) => runTransactions(input, rng),
};

export const readCommittedAlgo: AlgoDef<TableState, TxnProgram> = {
  id: "dirty-reads-committed",
  title: "read committed",
  code: CODE,
  counters,
  generateInput: () => program("read committed"),
  run: (input, rng) => runTransactions(input, rng),
};
