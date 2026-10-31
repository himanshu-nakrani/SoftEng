"use client";

import { SectionAlgoFigure } from "@/components/lesson/SectionAlgoFigure";
import { RefactorView } from "@/engine/algo/views/RefactorView";
import { extractClassAlgo } from "./extract-class";

/**
 * The RSC boundary: an AlgoDef carries functions, so the server page imports
 * this wrapper rather than the def. This is also the only place allowed to name
 * a view COMPONENT.
 */
export function ExtractClassFigure() {
  return (
    <SectionAlgoFigure
      def={extractClassAlgo}
      view={RefactorView}
      description="OrderProcessor calculates order totals and formats receipts. Step forward to extract receipt formatting into ReceiptFormatter: OrderProcessor drops from cyclomatic complexity 7 to 3 and fan-out 5 to 3, while module max fan-out drops from 5 to 3."
    />
  );
}
