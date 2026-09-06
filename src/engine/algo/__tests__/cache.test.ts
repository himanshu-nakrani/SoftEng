import { buildAlgoSteps } from "@/engine/algo/build";
import { CACHE_COUNTERS, runCache, type CacheConfig } from "@/engine/algo/cache";
import type { AlgoDef } from "@/engine/algo/types";
import type { CacheState } from "@/engine/algo/views/cache";
import { CacheView } from "@/engine/algo/views/CacheView";
import type { ComponentType } from "react";
import { describe, expect, it } from "vitest";

const C = CACHE_COUNTERS;
const pages = { a: 0, b: 0 };
const writes: CacheConfig["ops"] = [
  { kind: "write", page: "a", value: 1 },
  { kind: "write", page: "b", value: 2 },
  { kind: "fsync" },
];

const last = (cfg: CacheConfig) => runCache(cfg).at(-1)!;

describe("runCache", () => {
  it("write-back crash before fsync loses dirty pages", () => {
    const { state, counters } = last({
      policy: "writeback",
      pages,
      ops: writes,
      crashAfter: 2,
    });
    expect(counters[C.lost]).toBe(2);
    expect(state.pages.every((p) => p.cached === p.disk)).toBe(true);
    expect(state.pages.find((p) => p.id === "a")!.disk).toBe(0);
  });

  it("write-back after fsync loses nothing", () => {
    const { counters } = last({
      policy: "writeback",
      pages,
      ops: writes,
      crashAfter: 3,
    });
    expect(counters[C.lost] ?? 0).toBe(0);
    expect(counters[C.diskWrites]).toBe(2);
  });

  it("write-through never dirties, so a crash loses nothing", () => {
    const { counters } = last({
      policy: "writethrough",
      pages,
      ops: writes,
      crashAfter: 2,
    });
    expect(counters[C.lost] ?? 0).toBe(0);
    expect(counters[C.diskWrites]).toBe(2);
  });

  it("never aliases", () => {
    const steps = runCache({ policy: "writeback", pages, ops: writes, crashAfter: 3 });
    expect(new Set(steps.map((s) => s.state)).size).toBe(steps.length);
  });
});

describe("cache rides on archetype B", () => {
  const def: AlgoDef<CacheState, CacheConfig> = {
    id: "cache",
    title: "write-back",
    code: ["write through", "write in cache", "fsync", "crash"],
    counters: [{ key: C.lost, label: "lost on crash" }],
    size: { label: "ops before crash", min: 0, max: 3, default: 2 },
    generateInput: (_rng, size) => ({
      policy: "writeback",
      pages,
      ops: writes,
      crashAfter: size,
    }),
    run: (input) => runCache(input),
  };

  it("size is the crash point and the view contract holds", () => {
    expect(buildAlgoSteps(def, 2, 1)).not.toEqual(buildAlgoSteps(def, 3, 1));
    const view: ComponentType<{ state: CacheState }> = CacheView;
    expect(view).toBe(CacheView);
  });
});
