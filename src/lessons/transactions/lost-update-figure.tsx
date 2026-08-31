"use client";

import { SectionAlgoFigure } from "@/components/lesson/SectionAlgoFigure";
import { TableView } from "@/engine/algo/views/TableView";
import { lostUpdateAlgo, lostUpdateSerializableAlgo } from "./lost-update";

export function LostUpdateFigure() {
  return (
    <SectionAlgoFigure
      def={lostUpdateAlgo}
      view={TableView}
      description="A balance of 100, a deposit of 50 and a withdrawal of 30. Each transaction reads the balance, computes a new value from what it read, and writes it back. Under read committed, whenever both read before either writes, the second write overwrites the first — so the balance ends at 150 or 70 instead of 120, in about three runs in four, with no error reported."
    />
  );
}

export function LostUpdateSerializableFigure() {
  return (
    <SectionAlgoFigure
      def={lostUpdateSerializableAlgo}
      view={TableView}
      description="The identical program at serializable. The balance still ends at 150 or 70 — but one transaction's commit is refused rather than silently overwritten, so the application knows an update did not happen and can retry it. Exactly the runs that lost an update above are the runs refused here."
    />
  );
}
