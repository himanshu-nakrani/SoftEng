import { StepRecorder } from "./recorder";
import type { AlgoStep } from "./types";
import type { JournalState } from "./views/journal";

/**
 * File-system journaling — a step producer over `JournalState`.
 *
 * Two policies over the same create-file work: write the data block, then
 * the inode. `unordered` does those two writes on disk in that order.
 * `journal` appends the inode change to a log and forces it before the
 * inode itself is written. The size slider is the crash point.
 *
 * A crash after the data write but before the inode, with no journal,
 * leaves an allocated block the inode does not name — an orphan. With a
 * journal, a crash after the journal force still recovers the inode.
 *
 * Deliberately absent: data journaling, checksums, delayed allocation.
 * The argument is the same ordering rule WAL taught, applied to metadata.
 */

export type JournalPolicy = "unordered" | "journal";

export type JournalOp =
  | { kind: "data"; block: number }
  | { kind: "meta"; inode: string; block: number }
  | { kind: "jwrite"; inode: string; block: number }
  | { kind: "jforce" };

export interface JournalConfig {
  policy: JournalPolicy;
  ops: JournalOp[];
  crashAfter: number;
}

export const JOURNAL_COUNTERS = {
  dataWrites: "dataWrites",
  metaWrites: "metaWrites",
  journalWrites: "journalWrites",
  forces: "forces",
} as const;

export function runJournal(cfg: JournalConfig): AlgoStep<JournalState>[] {
  let dataOnDisk: number[] = [];
  let inodeOnDisk: number[] = [];
  let journal: { inode: string; block: number; forced: boolean }[] = [];
  let forcedUpTo = -1;
  let phase: JournalState["phase"] = "run";
  let last: JournalState["last"];

  const rec = new StepRecorder<JournalState>(() => snapshot());

  function snapshot(): JournalState {
    return {
      policy: cfg.policy,
      dataOnDisk: [...dataOnDisk],
      inodeOnDisk: [...inodeOnDisk],
      journal: journal.map((r) => ({ ...r })),
      forcedUpTo,
      phase,
      last,
      orphan: dataOnDisk.some((b) => !inodeOnDisk.includes(b)),
      stamp:
        phase === "crash"
          ? "power lost"
          : phase === "recover"
            ? "recovering"
            : rec.count(JOURNAL_COUNTERS.metaWrites) === 0
              ? cfg.policy
              : `${dataOnDisk.length} data · ${inodeOnDisk.length} in inode`,
    };
  }

  rec.record({
    note:
      cfg.policy === "journal"
        ? "Journaled: the inode change is forced to the log before the inode is."
        : "Unordered: data block, then inode. A crash between them orphans the block.",
  });

  const n = Math.min(cfg.crashAfter, cfg.ops.length);
  for (let i = 0; i < n; i++) {
    const op = cfg.ops[i]!;
    apply(op);
  }

  phase = "crash";
  last = { kind: "crash" };
  rec.record({
    codeLine: 4,
    note: "Power lost. Volatile state is gone.",
  });

  if (cfg.policy === "journal") {
    phase = "recover";
    const durable = journal.filter((r) => r.forced);
    for (const r of durable) {
      if (!inodeOnDisk.includes(r.block)) inodeOnDisk = [...inodeOnDisk, r.block];
      rec.bump(JOURNAL_COUNTERS.metaWrites);
      last = { kind: "meta", block: r.block };
      rec.record({
        codeLine: 5,
        note: `Replay journal: inode names block ${r.block}.`,
      });
    }
  }

  phase = "done";
  rec.record({
    note: dataOnDisk.some((b) => !inodeOnDisk.includes(b))
      ? "Orphan: a data block sits on disk that no inode names."
      : inodeOnDisk.length > 0
        ? "Consistent: every data block the inode names is the file."
        : "Nothing durable yet.",
  });

  return rec.steps;

  function apply(op: JournalOp): void {
    if (op.kind === "data") {
      dataOnDisk = [...dataOnDisk, op.block];
      rec.bump(JOURNAL_COUNTERS.dataWrites);
      last = { kind: "data", block: op.block };
      rec.record({
        codeLine: 0,
        note: `Write data block ${op.block} to disk.`,
      });
    } else if (op.kind === "meta") {
      inodeOnDisk = [...inodeOnDisk, op.block];
      rec.bump(JOURNAL_COUNTERS.metaWrites);
      last = { kind: "meta", block: op.block };
      rec.record({
        codeLine: 1,
        note: `Write inode: file now names block ${op.block}.`,
      });
    } else if (op.kind === "jwrite") {
      journal = [...journal, { inode: op.inode, block: op.block, forced: false }];
      rec.bump(JOURNAL_COUNTERS.journalWrites);
      last = { kind: "jwrite", block: op.block };
      rec.record({
        codeLine: 2,
        note: `Append inode change for block ${op.block} to the journal.`,
      });
    } else {
      journal = journal.map((r) => ({ ...r, forced: true }));
      forcedUpTo = journal.length - 1;
      rec.bump(JOURNAL_COUNTERS.forces);
      last = { kind: "jforce" };
      rec.record({
        codeLine: 3,
        note: "Force the journal. The inode change is now durable.",
      });
    }
  }
}
