import {
  TXN_COUNTERS,
  runTransactions,
  type Isolation,
  type TxnProgram,
} from "@/engine/algo/transactions";
import type { AlgoDef } from "@/engine/algo/types";
import type { TableState } from "@/engine/algo/views/table";

/**
 * Write Skew — archetype B (`engine: "steps"`).
 *
 * The anomaly a snapshot cannot fix, and the reason "serializable" is a different
 * kind of promise rather than a stricter one.
 *
 * Two doctors are on call. The rule is that at least one must remain. Each checks
 * whether the OTHER is on call, sees that they are, concludes it is safe to leave,
 * and writes only their own row. Neither transaction violates the rule as it sees
 * it. Both commit. Nobody is on call.
 *
 * Note what makes this different from a lost update: the two transactions write
 * DIFFERENT rows, so there is no overwrite to detect and no conflict a
 * last-writer-wins check would notice. The conflict is between one transaction's
 * READS and the other's WRITES, which is precisely what a snapshot hides.
 */

const CODE = [
  "count = others on call",
  "if count >= 1:",
  "  go off call",
  "COMMIT",
];

/**
 * One doctor deciding to leave.
 *
 * `mine`/`theirs` are the two on-call flags. The check reads the OTHER row, which
 * is the read that a snapshot answers with stale data.
 */
function doctor(id: string, name: string, mine: string, theirs: string) {
  return {
    id,
    name,
    statements: [
      {
        label: `check ${theirs}`,
        codeLine: 0,
        run: (ctx: { read: (r: string) => number }) => {
          ctx.read(theirs);
        },
      },
      {
        label: `go off call`,
        codeLine: 2,
        run: (ctx: { seen: Record<string, number>; write: (r: string, v: number) => void }) => {
          // The rule, applied honestly to what this transaction can see.
          if ((ctx.seen[theirs] ?? 0) >= 1) ctx.write(mine, 0);
        },
      },
      { label: "COMMIT", codeLine: 3, commit: true },
    ],
  };
}

function program(isolation: Isolation): TxnProgram {
  return {
    rows: { alice_oncall: 1, bob_oncall: 1 },
    txns: [
      doctor("T1", "T1 · alice", "alice_oncall", "bob_oncall"),
      doctor("T2", "T2 · bob", "bob_oncall", "alice_oncall"),
    ],
    isolation,
  };
}

const counters = [
  { key: TXN_COUNTERS.statements, label: "statements" },
  { key: TXN_COUNTERS.conflicts, label: "commits refused" },
];

/** Repeatable read: both snapshots say the other is on call. */
export const writeSkewAlgo: AlgoDef<TableState, TxnProgram> = {
  id: "write-skew",
  title: "repeatable read",
  code: CODE,
  counters,
  generateInput: () => program("repeatable read"),
  run: (input, rng) => runTransactions(input, rng),
};

/** Serializable: a commit is refused when the data it read has since changed. */
export const serializableAlgo: AlgoDef<TableState, TxnProgram> = {
  id: "write-skew-serializable",
  title: "serializable",
  code: CODE,
  counters,
  generateInput: () => program("serializable"),
  run: (input, rng) => runTransactions(input, rng),
};
