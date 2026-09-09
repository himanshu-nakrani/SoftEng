"use client";

import { SectionAlgoFigure } from "@/components/lesson/SectionAlgoFigure";
import { RefactorView } from "@/engine/algo/views/RefactorView";
import { extractFunctionAlgo } from "./extract-function";

/**
 * The RSC boundary: an AlgoDef carries functions, so the server page imports
 * this wrapper rather than the def. This is also the only place allowed to name
 * a view COMPONENT.
 */
export function ExtractFunctionFigure() {
  return (
    <SectionAlgoFigure
      def={extractFunctionAlgo}
      view={RefactorView}
      description="A long handler with a validate block at the top. Step forward to extract it into its own function and watch the module's max cyclomatic complexity fall from 7 to 6 while the total decision points stay fixed — the metric moves because the structure did, not because anyone typed it."
    />
  );
}
