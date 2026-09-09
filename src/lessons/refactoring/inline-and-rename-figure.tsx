"use client";

import { SectionAlgoFigure } from "@/components/lesson/SectionAlgoFigure";
import { RefactorView } from "@/engine/algo/views/RefactorView";
import { inlineAndRenameAlgo } from "./inline-and-rename";

/**
 * The RSC boundary: an AlgoDef carries functions, so the server page imports
 * this wrapper rather than the def. This is also the only place allowed to name
 * a view COMPONENT.
 */
export function InlineAndRenameFigure() {
  return (
    <SectionAlgoFigure
      def={inlineAndRenameAlgo}
      view={RefactorView}
      description="An over-thin helper inlined back into its one caller — the function count and the caller's fan-out both fall — then a vague function renamed at every call site, which moves no metric at all. Structure is a dial, not a ratchet."
    />
  );
}
