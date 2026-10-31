import { StepRecorder } from "./recorder";
import type { AlgoStep } from "./types";
import type {
  StorageEngine,
  StoragePage,
  StorageState,
} from "./views/storage";

/**
 * Storage engines — a step producer for archetype B, over `StorageState`.
 *
 * The seventh thing to ride the discrete-step engine, and the first in track 03
 * that is about amplification rather than isolation or durability. There is no
 * scheduler: a write either rewrites a B-tree leaf in place or appends to an
 * LSM memtable, and a read either walks a two-level tree or probes a stack of
 * SSTables. The run is a fixed sequence of those operations.
 *
 * WHAT IS MODELLED, AND WHAT IS NOT. Two engines over the same key alphabet
 * (`a`–`l`) and the same ops:
 *
 *   - B-tree: a root plus three leaves of four keys each (`a–d`, `e–h`, `i–l`).
 *     Every write reads root then leaf and rewrites the whole leaf — one key
 *     change is a full page write. Every read walks the same height, including
 *     a miss. That is write amplification as in-place update, and read
 *     amplification as a constant tree height.
 *   - LSM: writes append to a memtable of capacity 4. A full memtable flushes
 *     to a new SSTable (one page write). Three SSTables compact into one (the
 *     three runs are read, one run is written). A read probes SSTables newest
 *     first; a bloom miss skips a run that cannot contain the key.
 *
 * Deliberately absent: splits and merges that change B-tree height, bloom
 * false positives, leveled vs size-tiered compaction beyond "compact when
 * three runs exist", and a buffer cache. Those change the constants. The
 * argument is that the same logical writes produce different page counts
 * because one engine updates in place and the other defers the write.
 */

export type StorageOp =
  | { kind: "write"; key: string }
  | { kind: "read"; key: string };

export interface StorageScript {
  engine: StorageEngine;
  ops: StorageOp[];
  /** LSM memtable capacity in keys. Default 4. */
  memtableSize?: number;
  /** LSM: compact when this many SSTables exist. Default 3. */
  compactAfter?: number;
}

export const STORAGE_COUNTERS = {
  pageReads: "pageReads",
  pageWrites: "pageWrites",
  compactions: "compactions",
  bloomMisses: "bloomMisses",
} as const;

const LEAVES = [
  { id: "a–d", keys: ["a", "b", "c", "d"] },
  { id: "e–h", keys: ["e", "f", "g", "h"] },
  { id: "i–l", keys: ["i", "j", "k", "l"] },
] as const;

function leafFor(key: string): (typeof LEAVES)[number] | undefined {
  return LEAVES.find((leaf) => (leaf.keys as readonly string[]).includes(key));
}

interface Sstable {
  id: string;
  keys: Set<string>;
}

export function runStorage(script: StorageScript): AlgoStep<StorageState>[] {
  const memtableSize = script.memtableSize ?? 4;
  const compactAfter = script.compactAfter ?? 3;

  const btree: Record<string, Set<string>> = {
    "a–d": new Set(),
    "e–h": new Set(),
    "i–l": new Set(),
  };
  const memtable = new Map<string, number>();
  let sstables: Sstable[] = [];
  let seq = 0;
  let flushSeq = 0;
  let lastOp: StorageState["lastOp"];
  let found: boolean | undefined;
  let active = new Set<string>();
  let bloomSkip = new Set<string>();

  const rec = new StepRecorder<StorageState>(() => snapshot());

  function snapshot(): StorageState {
    const pages: StoragePage[] =
      script.engine === "btree" ? btreePages() : lsmPages();
    return {
      engine: script.engine,
      pages,
      lastOp,
      found,
      stamp: stampOf(),
    };
  }

  function btreePages(): StoragePage[] {
    return [
      {
        id: "root",
        keys: ["d", "h"],
        kind: "root",
        active: active.has("root"),
        bloomSkip: false,
      },
      ...LEAVES.map((leaf) => ({
        id: leaf.id,
        keys: [...btree[leaf.id]!].sort(),
        kind: "leaf" as const,
        active: active.has(leaf.id),
        bloomSkip: false,
      })),
    ];
  }

  function lsmPages(): StoragePage[] {
    const pages: StoragePage[] = [
      {
        id: "memtable",
        keys: [...memtable.keys()],
        kind: "memtable",
        active: active.has("memtable"),
        bloomSkip: false,
      },
    ];
    for (const table of sstables) {
      pages.push({
        id: table.id,
        keys: [...table.keys].sort(),
        kind: "sstable",
        active: active.has(table.id),
        bloomSkip: bloomSkip.has(table.id),
      });
    }
    return pages;
  }

  function stampOf(): string {
    if (script.engine === "btree") {
      const writes = rec.count(STORAGE_COUNTERS.pageWrites);
      return writes === 0 ? "empty tree" : `${writes} leaf rewrite${writes === 1 ? "" : "s"}`;
    }
    const compact = rec.count(STORAGE_COUNTERS.compactions);
    const flushed = rec.count(STORAGE_COUNTERS.pageWrites) - compact;
    if (flushed === 0 && compact === 0) return "memtable only";
    const flushBit = `${flushed} flush${flushed === 1 ? "" : "es"}`;
    const compactBit = compact === 0 ? "no compact" : `${compact} compaction`;
    return `${flushBit} · ${compactBit}`;
  }

  rec.record({
    note:
      script.engine === "btree"
        ? "A root and three empty leaves. A write will rewrite whichever leaf the key belongs to."
        : "An empty memtable. Writes land here until it fills; nothing is on disk yet.",
  });

  for (const op of script.ops) {
    active = new Set();
    bloomSkip = new Set();
    found = undefined;
    if (op.kind === "write") {
      if (script.engine === "btree") writeBtree(op.key);
      else writeLsm(op.key);
    } else if (script.engine === "btree") {
      readBtree(op.key);
    } else {
      readLsm(op.key);
    }
  }

  return rec.steps;

  function writeBtree(key: string): void {
    const leaf = leafFor(key);
    lastOp = { kind: "write", key };
    rec.bump(STORAGE_COUNTERS.pageReads, 2);
    rec.bump(STORAGE_COUNTERS.pageWrites);
    active = new Set(leaf ? ["root", leaf.id] : ["root"]);
    if (leaf) btree[leaf.id]!.add(key);
    rec.record({
      codeLine: 1,
      note: leaf
        ? `Write ${key}: walked root → ${leaf.id} and rewrote the whole leaf.`
        : `Write ${key}: no leaf owns this key.`,
    });
  }

  function readBtree(key: string): void {
    const leaf = leafFor(key);
    lastOp = { kind: "read", key };
    rec.bump(STORAGE_COUNTERS.pageReads, 2);
    active = new Set(leaf ? ["root", leaf.id] : ["root"]);
    found = leaf ? btree[leaf.id]!.has(key) : false;
    rec.record({
      codeLine: 2,
      note: found
        ? `Read ${key}: root then ${leaf!.id}, found.`
        : `Read ${key}: root then ${leaf ? leaf.id : "nowhere"} — missing, but the height was still paid.`,
    });
  }

  function writeLsm(key: string): void {
    lastOp = { kind: "write", key };
    memtable.set(key, ++seq);
    active = new Set(["memtable"]);
    rec.record({
      codeLine: 0,
      note: `Append ${key} to the memtable (${memtable.size}/${memtableSize}).`,
    });
    if (memtable.size >= memtableSize) flush();
    if (sstables.length >= compactAfter) compact();
  }

  function flush(): void {
    flushSeq += 1;
    const id = `sst${flushSeq}`;
    const keys = new Set(memtable.keys());
    memtable.clear();
    sstables = [...sstables, { id, keys }];
    lastOp = { kind: "flush" };
    active = new Set([id]);
    rec.bump(STORAGE_COUNTERS.pageWrites);
    rec.record({
      codeLine: 1,
      note: `Memtable full — flushed ${[...keys].sort().join(", ")} as ${id}.`,
    });
  }

  function compact(): void {
    const merged = new Set<string>();
    // Oldest first, then newer overwrites: last-write-wins across runs.
    for (const table of sstables) {
      for (const key of table.keys) merged.add(key);
    }
    rec.bump(STORAGE_COUNTERS.pageReads, sstables.length);
    rec.bump(STORAGE_COUNTERS.pageWrites);
    rec.bump(STORAGE_COUNTERS.compactions);
    const id = `sst${++flushSeq}`;
    lastOp = { kind: "compact" };
    active = new Set([id]);
    sstables = [{ id, keys: merged }];
    rec.record({
      codeLine: 2,
      note: `Three runs compacted into ${id} (${merged.size} keys).`,
    });
  }

  function readLsm(key: string): void {
    lastOp = { kind: "read", key };
    active = new Set();
    bloomSkip = new Set();
    if (memtable.has(key)) {
      found = true;
      active.add("memtable");
      rec.record({
        codeLine: 3,
        note: `Read ${key}: hit in the memtable, no page read.`,
      });
      return;
    }
    // Newest SSTable first — a newer run's value wins, so we can stop at the
    // first hit. A bloom miss is a table we do not read.
    for (let i = sstables.length - 1; i >= 0; i--) {
      const table = sstables[i]!;
      if (!table.keys.has(key)) {
        rec.bump(STORAGE_COUNTERS.bloomMisses);
        bloomSkip.add(table.id);
        continue;
      }
      rec.bump(STORAGE_COUNTERS.pageReads);
      active.add(table.id);
      found = true;
      rec.record({
        codeLine: 3,
        note: `Read ${key}: bloom skipped ${bloomSkip.size}, then ${table.id} had it.`,
      });
      return;
    }
    found = false;
    rec.record({
      codeLine: 3,
      note:
        sstables.length === 0
          ? `Read ${key}: memtable empty, no runs — miss, no page read.`
          : `Read ${key}: bloom said no on every run — miss, no page read.`,
    });
  }
}
