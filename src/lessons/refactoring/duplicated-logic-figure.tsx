"use client";

import { SectionAlgoFigure } from "@/components/lesson/SectionAlgoFigure";
import { RefactorView } from "@/engine/algo/views/RefactorView";
import { duplicatedLogicAlgo } from "./duplicated-logic";

/**
 * The RSC boundary: an AlgoDef carries functions, so the server page imports
 * this wrapper rather than the def. This is also the only place allowed to name
 * a view COMPONENT.
 */
export function DuplicatedLogicFigure() {
  return (
    <SectionAlgoFigure
      def={duplicatedLogicAlgo}
      view={RefactorView}
      description="Two handlers with the same validation branch inline. Extract it once, then point the second handler at that same function — the duplication count falls to zero and the total decision points drop, because a copy was deleted rather than moved."
    />
  );
}
