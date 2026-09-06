"use client";

import { SectionAlgoFigure } from "@/components/lesson/SectionAlgoFigure";
import { QueryPlanView } from "@/engine/algo/views/QueryPlanView";
import { clusteredAlgo, scanAlgo, secondaryAlgo } from "./index-vs-scan";

export function SecondaryIndexFigure() {
  return (
    <SectionAlgoFigure
      def={secondaryAlgo}
      view={QueryPlanView}
      description="A secondary index over an eight-page heap. Default three matching rows: two index pages plus three heap bookmarks is five page reads. Drag toward seven: each extra match adds one random heap fetch, and at seven matches the path reads nine pages."
    />
  );
}

export function TableScanFigure() {
  return (
    <SectionAlgoFigure
      def={scanAlgo}
      view={QueryPlanView}
      description="The same eight-page heap, scanned. Every page is read, 32 rows examined, no bookmarks. Drag the match count: the page-reads meter stays at 8, because a scan does not care how many rows qualify."
    />
  );
}

export function ClusteredIndexFigure() {
  return (
    <SectionAlgoFigure
      def={clusteredAlgo}
      view={QueryPlanView}
      description="A clustered index on the heap's own order, at seven matching rows — the point where the secondary path has already lost. Two index pages plus two contiguous heap pages is four page reads, still half the scan."
    />
  );
}
