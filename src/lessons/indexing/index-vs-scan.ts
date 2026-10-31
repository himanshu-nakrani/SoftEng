import {
  QUERY_COUNTERS,
  runQueryPlan,
  type QueryPlanInput,
} from "@/engine/algo/queryPlan";
import type { AlgoDef } from "@/engine/algo/types";
import type { QueryPlanState } from "@/engine/algo/views/queryPlan";

/**
 * Indexes and Query Plans — archetype B (`engine: "steps"`).
 *
 * The B-tree lesson showed what an in-place leaf costs to WRITE. This lesson
 * asks what a query costs to READ, and whether an index is always the cheaper
 * path. A table scan reads every heap page, always eight here. A secondary
 * index seeks in two hops and then bookmarks into the heap once per match. A
 * clustered index seeks and then walks contiguous pages. Measured: from seven
 * matching rows the secondary path reads nine pages and the scan still reads
 * eight. The clustered path at that same point reads four.
 *
 * THE CONTROL IS HOW MANY ROWS MATCH. Every position is a different cost. The
 * scan does not move. The secondary path grows by one page per match. They
 * meet at six and the index loses at seven.
 *
 * MODELLING NOTE, and its limits. The heap is 8 pages × 4 rows. Matching rows
 * are a contiguous range packed from page 0 — that is what a clustered index
 * is for. The secondary executor has no buffer cache, so two bookmarks to the
 * same page still cost two reads. A real engine would collapse those. That
 * moves the crossover; it does not remove it. Bitmap scans, covering indexes,
 * and a cost model in milliseconds are absent for the same reason.
 */

const SECONDARY_CODE = [
  "seek in secondary",
  "fetch heap row",
  "repeat per match",
];

const SCAN_CODE = [
  "read next heap page",
  "examine every row",
];

const CLUSTERED_CODE = [
  "seek clustered leaf",
  "read contiguous pages",
];

const counters = [
  { key: QUERY_COUNTERS.pageReads, label: "page reads" },
  { key: QUERY_COUNTERS.bookmarkLookups, label: "bookmark lookups" },
  { key: QUERY_COUNTERS.rowsExamined, label: "rows examined" },
];

const sizeControl = {
  label: "matching rows",
  min: 1,
  max: 16,
  default: 3,
};

function def(
  id: string,
  title: string,
  code: string[],
  path: QueryPlanInput["path"],
  defaultSize: number,
): AlgoDef<QueryPlanState, QueryPlanInput> {
  return {
    id,
    title,
    code,
    counters,
    size: { ...sizeControl, default: defaultSize },
    generateInput: (_rng, size) => ({ path, matches: size }),
    run: (input) => runQueryPlan(input),
  };
}

export const secondaryAlgo = def(
  "index-vs-scan",
  "secondary index",
  SECONDARY_CODE,
  "secondary",
  3,
);

export const scanAlgo = def(
  "index-vs-scan-scan",
  "table scan",
  SCAN_CODE,
  "scan",
  7,
);

export const clusteredAlgo = def(
  "index-vs-scan-clustered",
  "clustered index",
  CLUSTERED_CODE,
  "clustered",
  7,
);
