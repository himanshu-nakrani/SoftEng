"use client";

import { SectionAlgoFigure } from "@/components/lesson/SectionAlgoFigure";
import { TableView } from "@/engine/algo/views/TableView";
import { serializableAlgo, writeSkewAlgo } from "./write-skew";

export function WriteSkewFigure() {
  return (
    <SectionAlgoFigure
      def={writeSkewAlgo}
      view={TableView}
      description="Two doctors are on call and at least one must remain. Each transaction checks whether the other is on call, sees that they are, and takes itself off. Under repeatable read both snapshots say the other is still there, so in 76% of runs both commit and nobody is left on call — with neither transaction ever breaking the rule as it saw it."
    />
  );
}

export function SerializableFigure() {
  return (
    <SectionAlgoFigure
      def={serializableAlgo}
      view={TableView}
      description="The identical program at serializable. A commit is refused when a row the transaction read has since changed, so one doctor's transaction fails and must retry. Across two hundred seeds the invariant holds every time, and the refusals land on exactly the runs that would otherwise have broken it."
    />
  );
}
