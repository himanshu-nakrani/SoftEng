import {
  CACHE_COUNTERS,
  runCache,
  type CacheConfig,
} from "@/engine/algo/cache";
import type { AlgoDef } from "@/engine/algo/types";
import type { CacheState } from "@/engine/algo/views/cache";

/**
 * The Buffer Cache — archetype B (`engine: "steps"`).
 *
 * write() copies into RAM and returns. The caller has been acknowledged; the
 * disk has not moved. Write-back leaves those pages dirty until fsync. A crash
 * in that window reverts them. Write-through pays a disk write on every
 * write(), so the cache is a copy, not a delay, and a crash has nothing to
 * lose.
 *
 * Both figures run the same two pages and the same three operations. THE
 * CONTROL IS THE CRASH POINT. Measured: write-back crash 2 loses both
 * (lost 2, disk still 0, diskWrites 0); crash 3 — after fsync — lost 0,
 * diskWrites 2. Write-through crash 2: lost 0, diskWrites 2.
 *
 * MODELLING NOTE, and its limits. No background flusher, no page replacement,
 * no delayed allocation. A real kernel writes dirty pages back over time;
 * fsync is the explicit force. This figure is the loss window, not the whole
 * cache.
 */

const PAGES = { a: 0, b: 0 };

const OPS: CacheConfig["ops"] = [
  { kind: "write", page: "a", value: 1 },
  { kind: "write", page: "b", value: 2 },
  { kind: "fsync" },
];

function cfg(
  policy: CacheConfig["policy"],
  crashAfter: number,
): CacheConfig {
  return { policy, pages: PAGES, ops: OPS, crashAfter };
}

const crashControl = {
  label: "operations before the crash",
  min: 0,
  max: OPS.length,
  default: 2,
};

const counters = [
  { key: CACHE_COUNTERS.cacheWrites, label: "cache writes" },
  { key: CACHE_COUNTERS.diskWrites, label: "disk writes" },
  { key: CACHE_COUNTERS.lost, label: "lost on crash" },
];

const CODE = [
  "write through to disk",
  "write dirty in cache",
  "fsync dirty pages",
  "-- power fails --",
];

/** Write-back: a write dirties the cache. Only fsync talks to disk. */
export const bufferCacheWritebackAlgo: AlgoDef<CacheState, CacheConfig> = {
  id: "buffer-cache",
  title: "write-back",
  code: CODE,
  counters,
  size: crashControl,
  generateInput: (_rng, size) => cfg("writeback", size),
  run: (input) => runCache(input),
};

/** Write-through: every write is a disk write. The cache is a copy. */
export const bufferCacheWritethroughAlgo: AlgoDef<CacheState, CacheConfig> = {
  id: "buffer-cache-writethrough",
  title: "write-through",
  code: CODE,
  counters,
  size: crashControl,
  generateInput: (_rng, size) => cfg("writethrough", size),
  run: (input) => runCache(input),
};
