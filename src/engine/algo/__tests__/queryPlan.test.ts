import { buildAlgoSteps } from "@/engine/algo/build";
import {
  HEAP_PAGES,
  QUERY_COUNTERS,
  ROWS_PER_PAGE,
  runQueryPlan,
  type QueryPlanInput,
} from "@/engine/algo/queryPlan";
import type { AlgoDef } from "@/engine/algo/types";
import type { QueryPlanState } from "@/engine/algo/views/queryPlan";
import { QueryPlanView } from "@/engine/algo/views/QueryPlanView";
import type { ComponentType } from "react";
import { describe, expect, it } from "vitest";

const C = QUERY_COUNTERS;
const HEAP = HEAP_PAGES * ROWS_PER_PAGE;

function input(path: QueryPlanInput["path"], matches: number): QueryPlanInput {
  return { path, matches };
}

const last = (steps: { state: QueryPlanState; counters: Record<string, number> }[]) =>
  steps[steps.length - 1];

describe("runQueryPlan", () => {
  it("is deterministic and starts from the untouched heap", () => {
    const a = runQueryPlan(input("scan", 4));
    expect(a).toEqual(runQueryPlan(input("scan", 4)));
    const first = a[0]!.state;
    expect(first.heap).toHaveLength(HEAP_PAGES);
    expect(first.heap.every((p) => !p.read && !p.bookmark)).toBe(true);
    expect(a[0]!.counters[C.pageReads] ?? 0).toBe(0);
    expect(first.examined).toBe(0);
  });

  it("never aliases a frame", () => {
    const steps = runQueryPlan(input("secondary", 7));
    expect(new Set(steps.map((s) => s.state)).size).toBe(steps.length);
    expect(new Set(steps.map((s) => s.state.heap)).size).toBe(steps.length);
  });

  it("keeps counters monotonic", () => {
    for (const path of ["scan", "clustered", "secondary"] as const) {
      const steps = runQueryPlan(input(path, 8));
      const totals: Record<string, number> = {};
      for (const step of steps) {
        for (const [key, value] of Object.entries(step.counters)) {
          expect(value).toBeGreaterThanOrEqual(totals[key] ?? 0);
          totals[key] = value;
        }
      }
    }
  });
});

describe("a table scan reads every heap page, regardless of matches", () => {
  it("costs HEAP_PAGES page reads at 1 match and at 16", () => {
    expect(last(runQueryPlan(input("scan", 1))).counters[C.pageReads]).toBe(HEAP_PAGES);
    expect(last(runQueryPlan(input("scan", 16))).counters[C.pageReads]).toBe(HEAP_PAGES);
    expect(last(runQueryPlan(input("scan", 8))).counters[C.rowsExamined]).toBe(HEAP);
    expect(last(runQueryPlan(input("scan", 8))).counters[C.bookmarkLookups] ?? 0).toBe(0);
  });
});

describe("a secondary index pays a bookmark per match", () => {
  it("reads height 2 plus one heap page per matching row", () => {
    for (const matches of [1, 3, 7, 16]) {
      const { counters } = last(runQueryPlan(input("secondary", matches)));
      expect(counters[C.pageReads]).toBe(2 + matches);
      expect(counters[C.bookmarkLookups]).toBe(matches);
      expect(counters[C.rowsExamined]).toBe(matches);
    }
  });
});

describe("a clustered index reads contiguous leaves, not one page per row", () => {
  it("reads height 2 plus ceil(matches / rowsPerPage) heap pages", () => {
    for (const matches of [1, 4, 5, 16]) {
      const { counters } = last(runQueryPlan(input("clustered", matches)));
      expect(counters[C.pageReads]).toBe(2 + Math.ceil(matches / ROWS_PER_PAGE));
      expect(counters[C.bookmarkLookups] ?? 0).toBe(0);
    }
  });
});

describe("the tipping point is measured, not asserted in prose", () => {
  it("secondary costs more than a scan from 7 matches, never fewer matches", () => {
    const scanCost = last(runQueryPlan(input("scan", 1))).counters[C.pageReads]!;
    let firstLoss = -1;
    for (let m = 1; m <= 16; m++) {
      const secondary = last(runQueryPlan(input("secondary", m))).counters[C.pageReads]!;
      if (secondary > scanCost && firstLoss === -1) firstLoss = m;
    }
    expect(firstLoss).toBe(7);
    expect(last(runQueryPlan(input("secondary", 6))).counters[C.pageReads]).toBe(scanCost);
    expect(last(runQueryPlan(input("secondary", 7))).counters[C.pageReads]).toBe(scanCost + 1);
    // Clustered is still cheaper than the scan at that same point.
    expect(last(runQueryPlan(input("clustered", 7))).counters[C.pageReads]!).toBeLessThan(scanCost);
  });
});

describe("query plans ride on archetype B", () => {
  const def: AlgoDef<QueryPlanState, QueryPlanInput> = {
    id: "index-vs-scan",
    title: "secondary index",
    code: [
      "seek in secondary",
      "fetch heap row",
      "repeat per match",
    ],
    counters: [
      { key: C.pageReads, label: "page reads" },
      { key: C.bookmarkLookups, label: "bookmark lookups" },
      { key: C.rowsExamined, label: "rows examined" },
    ],
    size: { label: "matching rows", min: 1, max: 16, default: 3 },
    generateInput: (_rng, size) => input("secondary", size),
    run: (input) => runQueryPlan(input),
  };

  it("runs through buildAlgoSteps, and size changes the run", () => {
    expect(buildAlgoSteps(def, 3, 42)).toEqual(buildAlgoSteps(def, 3, 42));
    expect(buildAlgoSteps(def, 3, 42)).not.toEqual(buildAlgoSteps(def, 7, 42));
  });

  it("ignores the seed", () => {
    expect(buildAlgoSteps(def, 7, 1)).toEqual(buildAlgoSteps(def, 7, 999));
  });

  it("satisfies the view contract the figure requires", () => {
    const view: ComponentType<{ state: QueryPlanState }> = QueryPlanView;
    expect(view).toBe(QueryPlanView);
  });
});
