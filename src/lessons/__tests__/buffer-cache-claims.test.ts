import { buildAlgoSteps } from "@/engine/algo/build";
import { CACHE_COUNTERS as C } from "@/engine/algo/cache";
import type { AlgoDef } from "@/engine/algo/types";
import type { CacheState } from "@/engine/algo/views/cache";
import {
  bufferCacheWritebackAlgo,
  bufferCacheWritethroughAlgo,
} from "@/lessons/storage-io/buffer-cache";
import { describe, expect, it } from "vitest";

/**
 * The buffer-cache prose states numbers. A failure here means the page now
 * lies, and the message should name the sentence that became untrue.
 *
 * Both figures drive `runCache` with the crash point as the SIZE argument.
 */

function at<I>(def: AlgoDef<CacheState, I>, crashAfter: number, seed = 42) {
  const steps = buildAlgoSteps(def, crashAfter, seed);
  const last = steps[steps.length - 1]!;
  const crash = steps.find((s) => s.state.phase === "crash");
  const diskOf = (state: CacheState) =>
    Object.fromEntries(state.pages.map((p) => [p.id, p.disk])) as Record<
      string,
      number
    >;
  const cachedOf = (state: CacheState) =>
    Object.fromEntries(state.pages.map((p) => [p.id, p.cached])) as Record<
      string,
      number
    >;
  return {
    steps,
    state: last.state,
    counters: last.counters,
    disk: diskOf(last.state),
    cached: cachedOf(last.state),
    crash,
    last,
    diskOf,
    cachedOf,
  };
}

const POINTS = [0, 1, 2, 3] as const;
const wb = (n: number) => at(bufferCacheWritebackAlgo, n);
const wt = (n: number) => at(bufferCacheWritethroughAlgo, n);

describe("buffer-cache · the slider is the crash point", () => {
  it("offers 0 through 3, default 2, and every position crashes", () => {
    // "The slider is not a size — it is where the power fails."
    for (const def of [bufferCacheWritebackAlgo, bufferCacheWritethroughAlgo]) {
      expect(def.size).toMatchObject({
        min: 0,
        max: 3,
        default: 2,
        label: "operations before the crash",
      });
      for (const c of POINTS) {
        expect(at(def, c).crash).toBeDefined();
      }
    }
  });

  it("both figures write a=1, b=2, then fsync, on pages that start at 0", () => {
    // "Two pages, a and b, both start at 0. Three operations: write a=1,
    // write b=2, fsync."
    for (const def of [bufferCacheWritebackAlgo, bufferCacheWritethroughAlgo]) {
      const input = def.generateInput(() => 0, 2);
      expect(input.pages).toEqual({ a: 0, b: 0 });
      expect(input.ops).toEqual([
        { kind: "write", page: "a", value: 1 },
        { kind: "write", page: "b", value: 2 },
        { kind: "fsync" },
      ]);
      expect(input.crashAfter).toBe(2);
    }
    expect(bufferCacheWritebackAlgo.generateInput(() => 0, 2).policy).toBe(
      "writeback",
    );
    expect(bufferCacheWritethroughAlgo.generateInput(() => 0, 2).policy).toBe(
      "writethrough",
    );
  });

  it("ignores the seed: a crash point is not a scheduler", () => {
    expect(buildAlgoSteps(bufferCacheWritebackAlgo, 2, 1)).toEqual(
      buildAlgoSteps(bufferCacheWritebackAlgo, 2, 99),
    );
    expect(buildAlgoSteps(bufferCacheWritethroughAlgo, 2, 1)).toEqual(
      buildAlgoSteps(bufferCacheWritethroughAlgo, 2, 99),
    );
  });
});

describe("buffer-cache · write-back claims", () => {
  it("crash 2 loses both writes: lost 2, disk still 0, disk writes 0", () => {
    // "Leave the crash at 2. ... Stamp reads 2 dirty. Disk chips still a 0
    // and b 0. Cache writes 2, disk writes 0."
    // "Step into the crash. Stamp flips to 2 lost. Both pages revert to 0.
    // The last caption: 2 acknowledged writes never reached disk."
    const run = wb(2);
    const beforeCrash = run.steps.find(
      (s) => s.state.phase === "run" && (s.counters[C.cacheWrites] ?? 0) === 2,
    )!;
    expect(beforeCrash.state.stamp).toBe("2 dirty");
    expect(run.diskOf(beforeCrash.state)).toEqual({ a: 0, b: 0 });
    expect(run.cachedOf(beforeCrash.state)).toEqual({ a: 1, b: 2 });
    expect(beforeCrash.note).toBe("Write b=2 in cache (dirty).");
    expect(beforeCrash.counters[C.diskWrites] ?? 0).toBe(0);

    expect(run.crash!.state.stamp).toBe("2 lost");
    expect(run.crash!.note).toBe("Crash. 2 dirty pages revert to disk.");
    expect(run.last.note).toBe(
      "2 acknowledged writes never reached disk.",
    );
    expect(run.counters[C.lost]).toBe(2);
    expect(run.counters[C.diskWrites] ?? 0).toBe(0);
    expect(run.counters[C.cacheWrites]).toBe(2);
    expect(run.disk).toEqual({ a: 0, b: 0 });
    expect(run.cached).toEqual({ a: 0, b: 0 });
  });

  it("crash 3 — after fsync — loses nothing: lost 0, disk writes 2", () => {
    // "Drag to 3. fsync first: every dirty page hits disk, disk writes 2,
    // disk a=1 b=2. Then the crash: 0 lost."
    const run = wb(3);
    const fsync = run.steps.find((s) => s.note?.startsWith("fsync:"));
    expect(fsync).toBeDefined();
    expect(fsync!.note).toBe("fsync: every dirty page hits disk.");
    expect(fsync!.counters[C.diskWrites]).toBe(2);
    expect(run.diskOf(fsync!.state)).toEqual({ a: 1, b: 2 });
    expect(run.crash!.state.stamp).toBe("0 lost");
    expect(run.crash!.note).toBe(
      "Crash. Cache is gone; disk already had every write.",
    );
    expect(run.last.note).toBe("Nothing lost.");
    expect(run.counters[C.lost] ?? 0).toBe(0);
    expect(run.counters[C.diskWrites]).toBe(2);
    expect(run.counters[C.cacheWrites]).toBe(2);
    expect(run.disk).toEqual({ a: 1, b: 2 });
  });

  it("crash 1 loses the one dirty page; crash 0 loses nothing", () => {
    // "Drag to 1: one dirty page, lost 1, disk still 0. Drag to 0:
    // nothing had been written, so there is nothing to lose."
    const one = wb(1);
    expect(one.counters[C.lost]).toBe(1);
    expect(one.counters[C.diskWrites] ?? 0).toBe(0);
    expect(one.counters[C.cacheWrites]).toBe(1);
    expect(one.disk).toEqual({ a: 0, b: 0 });
    expect(one.crash!.state.stamp).toBe("1 lost");
    expect(one.last.note).toBe("1 acknowledged write never reached disk.");

    const zero = wb(0);
    expect(zero.counters[C.lost] ?? 0).toBe(0);
    expect(zero.counters[C.diskWrites] ?? 0).toBe(0);
    expect(zero.counters[C.cacheWrites] ?? 0).toBe(0);
    expect(zero.disk).toEqual({ a: 0, b: 0 });
    expect(zero.last.note).toBe("Nothing lost.");
  });

  it("loses acknowledged work at two of the four crash points — 1 and 2", () => {
    // "Across the four crash points, write-back loses acknowledged work at
    // two of them — 1 and 2."
    const lostAt = POINTS.filter((c) => (wb(c).counters[C.lost] ?? 0) > 0);
    expect(lostAt).toEqual([1, 2]);
  });
});

describe("buffer-cache · write-through claims", () => {
  it("crash 2 loses nothing: lost 0, disk writes 2, disk a=1 b=2", () => {
    // "Leave the crash at 2. ... Stamp stays cache = disk. lost 0, disk
    // writes 2, disk a=1 b=2."
    const run = wt(2);
    const afterWrites = run.steps.find(
      (s) => s.state.phase === "run" && (s.counters[C.cacheWrites] ?? 0) === 2,
    )!;
    expect(afterWrites.state.stamp).toBe("cache = disk");
    expect(afterWrites.note).toBe("Write b=2 through to disk.");
    expect(run.diskOf(afterWrites.state)).toEqual({ a: 1, b: 2 });
    expect(afterWrites.state.pages.every((p) => !p.dirty)).toBe(true);

    expect(run.counters[C.lost] ?? 0).toBe(0);
    expect(run.counters[C.diskWrites]).toBe(2);
    expect(run.counters[C.cacheWrites]).toBe(2);
    expect(run.disk).toEqual({ a: 1, b: 2 });
    expect(run.last.note).toBe("Nothing lost.");
    expect(run.crash!.state.stamp).toBe("0 lost");
  });

  it("the same crash on write-back disagrees: lost 2, disk writes 0, disk still 0", () => {
    // "Compare write-back at the same crash: lost 2, disk writes 0, disk
    // still 0. Cache writes 2 either way."
    const back = wb(2);
    const through = wt(2);
    expect(back.counters[C.lost]).toBe(2);
    expect(back.counters[C.diskWrites] ?? 0).toBe(0);
    expect(back.disk).toEqual({ a: 0, b: 0 });
    expect(through.counters[C.lost] ?? 0).toBe(0);
    expect(through.counters[C.diskWrites]).toBe(2);
    expect(through.disk).toEqual({ a: 1, b: 2 });
    expect(back.counters[C.cacheWrites]).toBe(2);
    expect(through.counters[C.cacheWrites]).toBe(2);
  });

  it("crash 3 fsync is a no-op: disk writes stays 2", () => {
    // "Drag to 3. fsync runs against a clean cache; disk writes stays 2.
    // The force was already paid, one disk write per write()."
    const run = wt(3);
    const fsync = run.steps.find((s) => s.note?.startsWith("fsync:"));
    expect(fsync).toBeDefined();
    expect(fsync!.counters[C.diskWrites]).toBe(2);
    expect(fsync!.state.pages.every((p) => !p.dirty)).toBe(true);
    expect(run.counters[C.diskWrites]).toBe(2);
    expect(run.counters[C.lost] ?? 0).toBe(0);
    expect(run.disk).toEqual({ a: 1, b: 2 });
  });

  it("loses at none of the four crash points", () => {
    // "Write-through loses at none of the four crash points."
    for (const c of POINTS) {
      expect(wt(c).counters[C.lost] ?? 0).toBe(0);
    }
  });

  it("crash 2 write-through already matches crash 3 write-back", () => {
    // "Crash 2 write-through already matches crash 3 write-back: lost 0,
    // disk writes 2, disk a=1 b=2."
    const through = wt(2);
    const back = wb(3);
    expect(through.counters[C.lost] ?? 0).toBe(0);
    expect(back.counters[C.lost] ?? 0).toBe(0);
    expect(through.counters[C.diskWrites]).toBe(2);
    expect(back.counters[C.diskWrites]).toBe(2);
    expect(through.disk).toEqual({ a: 1, b: 2 });
    expect(back.disk).toEqual({ a: 1, b: 2 });
  });
});
