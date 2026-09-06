import {
  STORAGE_COUNTERS,
  runStorage,
  type StorageScript,
} from "@/engine/algo/storage";
import type { AlgoDef } from "@/engine/algo/types";
import type { StorageState } from "@/engine/algo/views/storage";

/**
 * B-Tree vs LSM — archetype B (`engine: "steps"`).
 *
 * Durability taught that a write is not durable until it reaches disk. This
 * lesson asks a different question of the same pages: how MANY pages does one
 * logical write (or read) touch? A B-tree answers by rewriting the leaf that
 * holds the key. An LSM answers by appending to a memtable and flushing later.
 * The same eight keys produce eight leaf rewrites on one engine and two
 * flushes on the other — measured, not narrated.
 *
 * THE CONTROL IS HOW MANY KEYS ARE WRITTEN. 4 / 8 / 12 are the interesting
 * positions: one flush, two flushes with no compact, and the compaction that
 * merges three runs. Every position is a different amplification picture.
 *
 * MODELLING NOTE, and its limits. The B-tree is a fixed two-level tree of
 * three leaves; it does not split. The LSM bloom filter has no false
 * positives, so a miss is a real skip. A buffer cache is absent, so the
 * B-tree pays the height on every operation. Those omissions change the
 * constants. They do not change the argument: in-place update rewrites a
 * whole page per key, and an append-only engine defers that cost to flush
 * and compaction.
 */

const KEYS = "abcdefghijkl".split("");

const BTREE_CODE = [
  "find leaf via root",
  "rewrite whole leaf",
  "read: root then leaf",
];

const LSM_CODE = [
  "append to memtable",
  "flush if memtable full",
  "compact if too many",
  "read: bloom each run",
];

function workload(engine: StorageScript["engine"], writes: number): StorageScript {
  return {
    engine,
    ops: [
      ...KEYS.slice(0, writes).map((key) => ({ kind: "write" as const, key })),
      { kind: "read", key: KEYS[0]! },
      { kind: "read", key: KEYS[Math.floor((writes - 1) / 2)]! },
      { kind: "read", key: KEYS[writes - 1]! },
      { kind: "read", key: "z" },
    ],
  };
}

const sizeControl = {
  label: "keys written",
  min: 4,
  max: 12,
  default: 8,
};

const counters = [
  { key: STORAGE_COUNTERS.pageReads, label: "page reads" },
  { key: STORAGE_COUNTERS.pageWrites, label: "page writes" },
  { key: STORAGE_COUNTERS.compactions, label: "compactions" },
  { key: STORAGE_COUNTERS.bloomMisses, label: "bloom misses" },
];

export const btreeAlgo: AlgoDef<StorageState, StorageScript> = {
  id: "btree-vs-lsm",
  title: "b-tree leaves",
  code: BTREE_CODE,
  counters,
  size: sizeControl,
  generateInput: (_rng, size) => workload("btree", size),
  run: (input) => runStorage(input),
};

export const lsmAlgo: AlgoDef<StorageState, StorageScript> = {
  id: "btree-vs-lsm-lsm",
  title: "lsm runs",
  code: LSM_CODE,
  counters,
  size: sizeControl,
  generateInput: (_rng, size) => workload("lsm", size),
  run: (input) => runStorage(input),
};
