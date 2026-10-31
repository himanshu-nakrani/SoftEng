import { StepRecorder } from "./recorder";
import type { AlgoStep } from "./types";
import type { CachePage, CachePolicy, CacheState } from "./views/cache";

/**
 * Buffer cache — a step producer over `CacheState`.
 *
 * Writes hit the cache. Under write-back they stay dirty until an fsync (or
 * a background flush). Under write-through every write is a disk write.
 * A crash discards the cache: dirty pages revert to their disk values.
 *
 * Deliberately absent: page replacement in the cache, delayed allocation,
 * and a flusher thread on its own clock. The argument is the loss window:
 * how many acknowledged writes are still only in RAM.
 */

export interface CacheConfig {
  policy: CachePolicy;
  /** Page ids and initial values (cache == disk). */
  pages: Record<string, number>;
  /** Writes, then a crash. `fsync` forces every dirty page. */
  ops: ({ kind: "write"; page: string; value: number } | { kind: "fsync" })[];
  crashAfter: number;
}

export const CACHE_COUNTERS = {
  cacheWrites: "cacheWrites",
  diskWrites: "diskWrites",
  lost: "lost",
} as const;

export function runCache(cfg: CacheConfig): AlgoStep<CacheState>[] {
  const pages: Record<string, { cached: number; disk: number }> = {};
  for (const [id, v] of Object.entries(cfg.pages)) {
    pages[id] = { cached: v, disk: v };
  }
  let phase: CacheState["phase"] = "run";
  let active: string | null = null;

  const rec = new StepRecorder<CacheState>(() => snapshot());

  function snapshot(): CacheState {
    const list: CachePage[] = Object.entries(pages).map(([id, p]) => ({
      id,
      cached: p.cached,
      disk: p.disk,
      dirty: p.cached !== p.disk,
      active: id === active,
    }));
    const dirty = list.filter((p) => p.dirty).length;
    return {
      policy: cfg.policy,
      pages: list,
      phase,
      stamp:
        phase === "crash"
          ? `${rec.count(CACHE_COUNTERS.lost)} lost`
          : dirty === 0
            ? "cache = disk"
            : `${dirty} dirty`,
    };
  }

  rec.record({
    note:
      cfg.policy === "writeback"
        ? "Write-back: a write dirties the cache. Only fsync (or crash) talks to disk."
        : "Write-through: every write is a disk write. The cache is a copy, not a delay.",
  });

  const n = Math.min(cfg.crashAfter, cfg.ops.length);
  for (let i = 0; i < n; i++) {
    const op = cfg.ops[i]!;
    active = null;
    if (op.kind === "write") {
      rec.bump(CACHE_COUNTERS.cacheWrites);
      pages[op.page]!.cached = op.value;
      active = op.page;
      if (cfg.policy === "writethrough") {
        pages[op.page]!.disk = op.value;
        rec.bump(CACHE_COUNTERS.diskWrites);
        rec.record({
          codeLine: 0,
          note: `Write ${op.page}=${op.value} through to disk.`,
        });
      } else {
        rec.record({
          codeLine: 1,
          note: `Write ${op.page}=${op.value} in cache (dirty).`,
        });
      }
    } else {
      for (const p of Object.values(pages)) {
        if (p.cached !== p.disk) {
          p.disk = p.cached;
          rec.bump(CACHE_COUNTERS.diskWrites);
        }
      }
      rec.record({
        codeLine: 2,
        note: "fsync: every dirty page hits disk.",
      });
    }
  }

  phase = "crash";
  let lost = 0;
  for (const p of Object.values(pages)) {
    if (p.cached !== p.disk) {
      lost += 1;
      p.cached = p.disk;
    }
  }
  rec.bump(CACHE_COUNTERS.lost, lost);
  rec.record({
    codeLine: 3,
    note:
      lost === 0
        ? "Crash. Cache is gone; disk already had every write."
        : `Crash. ${lost} dirty page${lost === 1 ? "" : "s"} revert to disk.`,
  });
  phase = "done";
  rec.record({ note: lost === 0 ? "Nothing lost." : `${lost} acknowledged write${lost === 1 ? "" : "s"} never reached disk.` });
  return rec.steps;
}
