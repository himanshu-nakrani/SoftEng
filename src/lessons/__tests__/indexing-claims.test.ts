import { buildAlgoSteps } from "@/engine/algo/build";
import { QUERY_COUNTERS as C } from "@/engine/algo/queryPlan";
import type { AlgoDef } from "@/engine/algo/types";
import type { QueryPlanState } from "@/engine/algo/views/queryPlan";
import {
  clusteredAlgo,
  scanAlgo,
  secondaryAlgo,
} from "@/lessons/indexing/index-vs-scan";
import { describe, expect, it } from "vitest";

/**
 * The indexes lesson states numbers. A failure here means the page now lies,
 * and the message should name the sentence that became untrue.
 */

function run<I>(def: AlgoDef<QueryPlanState, I>, size: number) {
  const steps = buildAlgoSteps(def, size, 42);
  return steps[steps.length - 1]!.counters;
}

describe("index-vs-scan: the scan is a constant, the secondary is a line", () => {
  it("a scan always reads 8 pages and examines 32 rows", () => {
    // "The page-reads meter stops at 8, and rows examined at 32."
    // "Drag matching rows from 1 to 16. The meters do not move."
    for (const m of [1, 7, 16]) {
      const c = run(scanAlgo, m);
      expect(c[C.pageReads]).toBe(8);
      expect(c[C.rowsExamined]).toBe(32);
      expect(c[C.bookmarkLookups] ?? 0).toBe(0);
    }
  });

  it("three matches on the secondary path cost five page reads", () => {
    // "Page reads land on 5 — two index pages plus three heap fetches."
    const c = run(secondaryAlgo, 3);
    expect(c[C.pageReads]).toBe(5);
    expect(c[C.bookmarkLookups]).toBe(3);
  });

  it("the secondary path crosses the scan at seven matching rows", () => {
    // "At six matches the secondary path reads 8 pages, tied with the scan.
    // At seven it reads 9."
    expect(run(secondaryAlgo, 6)[C.pageReads]).toBe(8);
    expect(run(secondaryAlgo, 7)[C.pageReads]).toBe(9);
    expect(run(scanAlgo, 7)[C.pageReads]).toBe(8);
    expect(run(secondaryAlgo, 16)[C.pageReads]).toBe(18);
  });

  it("a clustered seek at seven matches still reads four pages", () => {
    // "A clustered index on the same seven rows reads 4 pages"
    const c = run(clusteredAlgo, 7);
    expect(c[C.pageReads]).toBe(4);
    expect(c[C.bookmarkLookups] ?? 0).toBe(0);
  });
});
