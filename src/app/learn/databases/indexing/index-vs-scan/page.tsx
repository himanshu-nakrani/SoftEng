import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, LI, Lead, P, Strong, Term, TryThis } from "@/components/lesson/prose";
import {
  ClusteredIndexFigure,
  SecondaryIndexFigure,
  TableScanFigure,
} from "@/lessons/indexing/index-vs-scan-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("index-vs-scan");

export default function IndexVsScanPage() {
  return (
    <Lesson slug="index-vs-scan">
      <LessonSection id="access-path">
        <Lead>
          An index is a path through pages, not a promise that the path is
          short. The same predicate on the same heap can be answered by
          reading every page, by walking a range that is already in heap
          order, or by looking up each match and fetching it. Those are
          different <Term>access paths</Term>, and they cost different
          numbers of pages.
        </Lead>
        <P>
          The heap here is <Strong>8 pages of 4 rows</Strong>. Matching rows
          sit in a contiguous range packed from the first page — a range
          query on a clustering key. The slider is how many rows match, from
          1 to 16. A <Term>table scan</Term> reads all eight pages no matter
          where you set it. A <Term>secondary index</Term> seeks in two hops
          and then pays a <Term>bookmark lookup</Term> — a random heap fetch
          — for every match. A <Term>clustered index</Term> seeks, then
          walks the matching pages in order.
        </P>
      </LessonSection>

      <LessonSection id="secondary">
        <TryThis>
          <LI>
            Leave matching rows at <Strong>3</Strong>. Step through the
            seek, then three bookmarks. Page reads land on{" "}
            <Strong>5</Strong> — two index pages plus three heap fetches.
          </LI>
          <LI>
            Drag to <Strong>7</Strong>. Each extra match adds one heap
            fetch. The meter reads <Strong>9</Strong>.
          </LI>
          <LI>
            The dashed chips are bookmarks: random fetches, not a range.
            Two matches on the same page still cost two reads — this
            executor has no cache.
          </LI>
        </TryThis>
        <SecondaryIndexFigure />
        <Callout kind="insight">
          A secondary index does not read the table in order. It reads the
          index, then the heap, once per match. That is why its cost{" "}
          <Strong>grows with the result</Strong>, and why a selective query
          loves it: at three matches it is five pages against a scan&apos;s
          eight.
        </Callout>
      </LessonSection>

      <LessonSection id="scan">
        <TryThis>
          <LI>
            Step through all eight heap pages. The page-reads meter stops at{" "}
            <Strong>8</Strong>, and rows examined at <Strong>32</Strong>.
          </LI>
          <LI>
            Drag matching rows from 1 to 16. The meters do not move. A scan
            does not care how many rows qualify.
          </LI>
        </TryThis>
        <TableScanFigure />
        <Callout kind="insight">
          The scan&apos;s cost is a constant: the size of the heap. The
          secondary path&apos;s cost is a line: two plus the matches. A
          constant and a line cross. That crossing is the next section, and
          it is at <Strong>seven</Strong> matching rows on this heap.
        </Callout>
      </LessonSection>

      <LessonSection id="tipping-point">
        <Lead>
          From seven matching rows, the secondary index costs more than
          reading every page.
        </Lead>
        <P>
          At six matches the secondary path reads <Strong>8</Strong> pages,
          tied with the scan. At seven it reads <Strong>9</Strong>. The scan
          is still at eight, because it was always at eight. Past that point
          every extra match makes the index worse: sixteen matches cost the
          secondary path <Strong>18</Strong> pages against the same eight.
        </P>
        <P>
          That is not an argument against indexes. It is an argument against
          treating &quot;there is an index&quot; as a plan. A{" "}
          <Term>clustered index</Term> on the same seven rows reads{" "}
          <Strong>4</Strong> pages — two for the seek, two contiguous heap
          pages — because the matches already sit in order and there are no
          bookmarks. The index that loses is the one that turns a range into
          a loop of random fetches.
        </P>
        <TryThis>
          <LI>
            Seven matches, the point where the secondary path has lost. Step
            the clustered seek: page reads stop at <Strong>4</Strong>.
          </LI>
        </TryThis>
        <ClusteredIndexFigure />
        <P>
          Real planners have a buffer pool, a cost model in milliseconds,
          and covering indexes that never visit the heap. Those move the
          crossover. They do not remove it: a lookup whose result is a large
          fraction of the table is a scan with extra work, and the number of
          pages is how you see that before the query runs.
        </P>
      </LessonSection>
    </Lesson>
  );
}
