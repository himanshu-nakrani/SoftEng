"use client";

import { SectionAlgoFigure } from "@/components/lesson/SectionAlgoFigure";
import { TableView } from "@/engine/algo/views/TableView";
import { dirtyReadAlgo, readCommittedAlgo } from "./dirty-reads";

export function DirtyReadFigure() {
  return (
    <SectionAlgoFigure
      def={dirtyReadAlgo}
      view={TableView}
      description="Two transactions over two accounts holding 100 each. T1 moves 50 from alice to bob and then rolls back; T2 reads both rows and reports the total. Under read uncommitted, T2 can see T1's dashed, uncommitted values — so shuffle the seed and about one run in three reports a total of 150 or 250, neither of which any transaction ever committed."
    />
  );
}

export function ReadCommittedFigure() {
  return (
    <SectionAlgoFigure
      def={readCommittedAlgo}
      view={TableView}
      description="The identical program at read committed. T2's reads skip every pending write, so across two hundred seeds it reports 200 every time and the dirty-read counter never leaves zero."
    />
  );
}
