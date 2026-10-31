import { StepRecorder } from "./recorder";
import type { AlgoStep } from "./types";
import type {
  AccessPath,
  HeapPage,
  IndexNode,
  QueryPlanState,
} from "./views/queryPlan";

/**
 * Query plans — a step producer for archetype B, over `QueryPlanState`.
 *
 * The eighth thing to ride the discrete-step engine. Not a scheduler: a query
 * is a finite walk of pages, and the lesson is that the WALK you pick — scan
 * the heap, seek a clustered range, or look up a secondary index and bookmark
 * back into the heap — changes how many pages you touch, sometimes past the
 * point where reading everything would have been cheaper.
 *
 * WHAT IS MODELLED, AND WHAT IS NOT. A heap of 8 pages × 4 rows. Matching rows
 * are a contiguous range packed from page 0, which is what a clustered index
 * is for. Three access paths over that same heap:
 *
 *   - Scan: every heap page, always. Match count does not change the cost.
 *   - Clustered: index root + leaf, then ceil(matches / 4) contiguous heap
 *     pages. No bookmarks — the index IS the table order.
 *   - Secondary: index root + leaf, then one heap fetch per matching row.
 *     The naive executor does not keep a page cache, so two matches on the
 *     same page still cost two reads. That is the bookmark trap.
 *
 * Deliberately absent: a buffer pool that would collapse repeated bookmarks
 * to one page, bitmap AND of two indexes, and a cost model in milliseconds.
 * Those change the crossover by a constant. The argument is that secondary
 * cost grows with matches while a scan does not, so there is a measured
 * point at which the index loses.
 */

export const HEAP_PAGES = 8;
export const ROWS_PER_PAGE = 4;

export interface QueryPlanInput {
  path: AccessPath;
  /** How many rows match the predicate. 1–16 in the figure. */
  matches: number;
}

export const QUERY_COUNTERS = {
  pageReads: "pageReads",
  bookmarkLookups: "bookmarkLookups",
  rowsExamined: "rowsExamined",
} as const;

function heapShape(matches: number): HeapPage[] {
  return Array.from({ length: HEAP_PAGES }, (_, i) => {
    const start = i * ROWS_PER_PAGE;
    const pageMatches = Math.max(0, Math.min(ROWS_PER_PAGE, matches - start));
    return {
      id: `p${i}`,
      rows: ROWS_PER_PAGE,
      matches: pageMatches,
      read: false,
      bookmark: false,
    };
  });
}

export function runQueryPlan(input: QueryPlanInput): AlgoStep<QueryPlanState>[] {
  const matches = input.matches;
  const heap = heapShape(matches);
  const index: IndexNode[] = [
    { id: "root", kind: "root", active: false },
    { id: "leaf", kind: "leaf", active: false },
  ];
  let examined = 0;

  const rec = new StepRecorder<QueryPlanState>(() => snapshot());

  function snapshot(): QueryPlanState {
    return {
      path: input.path,
      heap: heap.map((p) => ({ ...p })),
      index: index.map((n) => ({ ...n })),
      matches,
      examined,
      stamp: stampOf(),
    };
  }

  function stampOf(): string {
    const reads = rec.count(QUERY_COUNTERS.pageReads);
    if (reads === 0) return `${matches} match${matches === 1 ? "" : "es"} · not yet read`;
    return `${reads} page read${reads === 1 ? "" : "s"}`;
  }

  function clearActive(): void {
    for (const n of index) n.active = false;
    for (const p of heap) {
      p.read = false;
      p.bookmark = false;
    }
  }

  rec.record({
    note:
      input.path === "scan"
        ? `A heap of ${HEAP_PAGES} pages. A scan will read every one, whatever matches.`
        : input.path === "clustered"
          ? `A clustered index on the heap's own order. ${matches} matching row${matches === 1 ? "" : "s"} sit in a contiguous range.`
          : `A secondary index. Each of ${matches} match${matches === 1 ? "" : "es"} will bookmark back into the heap.`,
  });

  if (input.path === "scan") scan();
  else if (input.path === "clustered") clustered();
  else secondary();

  return rec.steps;

  function scan(): void {
    for (const page of heap) {
      clearActive();
      page.read = true;
      rec.bump(QUERY_COUNTERS.pageReads);
      rec.bump(QUERY_COUNTERS.rowsExamined, page.rows);
      examined += page.rows;
      rec.record({
        codeLine: 0,
        note: `Scan ${page.id}: ${page.rows} rows examined, ${page.matches} matched.`,
      });
    }
  }

  function clustered(): void {
    seekIndex();
    const pagesNeeded = Math.ceil(matches / ROWS_PER_PAGE);
    for (let i = 0; i < pagesNeeded; i++) {
      clearActive();
      const page = heap[i]!;
      page.read = true;
      rec.bump(QUERY_COUNTERS.pageReads);
      rec.bump(QUERY_COUNTERS.rowsExamined, page.matches);
      examined += page.matches;
      rec.record({
        codeLine: 2,
        note: `Clustered leaf ${page.id}: ${page.matches} matching row${page.matches === 1 ? "" : "s"} already in heap order.`,
      });
    }
  }

  function secondary(): void {
    seekIndex();
    for (let i = 0; i < matches; i++) {
      clearActive();
      const page = heap[Math.floor(i / ROWS_PER_PAGE)]!;
      page.read = true;
      page.bookmark = true;
      rec.bump(QUERY_COUNTERS.pageReads);
      rec.bump(QUERY_COUNTERS.bookmarkLookups);
      rec.bump(QUERY_COUNTERS.rowsExamined);
      examined += 1;
      rec.record({
        codeLine: 1,
        note: `Bookmark ${i + 1}/${matches} → ${page.id}. A heap fetch, not a range.`,
      });
    }
  }

  function seekIndex(): void {
    clearActive();
    index[0]!.active = true;
    rec.bump(QUERY_COUNTERS.pageReads);
    rec.record({ codeLine: 0, note: "Seek: read the index root." });
    clearActive();
    index[1]!.active = true;
    rec.bump(QUERY_COUNTERS.pageReads);
    rec.record({ codeLine: 0, note: "Seek: read the index leaf." });
  }
}
