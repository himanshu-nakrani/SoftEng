"use client";

import { SectionAlgoFigure } from "@/components/lesson/SectionAlgoFigure";
import { MutationView } from "@/engine/algo/views/MutationView";
import {
  boundaryMutantsAlgo,
  boundaryMutantsEdgeAlgo,
} from "./boundary-mutants";

/**
 * The RSC boundary: an AlgoDef carries functions, so the server page imports
 * these wrappers rather than the defs. This is also the only file allowed to
 * name the view COMPONENT.
 */
export function FarTestsFigure() {
  return (
    <SectionAlgoFigure
      def={boundaryMutantsAlgo}
      view={MutationView}
      description="A seat-validity check under a suite that asserts exact answers but samples the middle of the range. Four of the five boundary mutants survive — the off-by-ones live at the edge, where no test looks."
    />
  );
}

export function AtTheEdgeFigure() {
  return (
    <SectionAlgoFigure
      def={boundaryMutantsEdgeAlgo}
      view={MutationView}
      description="The same seat-validity check and the same five mutants, now tested with inputs sitting exactly on the two boundaries. Every mutant is killed."
    />
  );
}
