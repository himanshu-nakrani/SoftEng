"use client";

import { SectionAlgoFigure } from "@/components/lesson/SectionAlgoFigure";
import { ArrayView } from "@/engine/algo/views/ArrayView";
import { propertyShrinkingAlgo } from "./property-shrinking";

/**
 * The RSC boundary: an AlgoDef carries functions, so the server page imports
 * this wrapper rather than the def. This is also the only place allowed to name
 * a view COMPONENT.
 */
export function PropertyShrinkingFigure() {
  return (
    <SectionAlgoFigure
      def={propertyShrinkingAlgo}
      view={ArrayView}
      description="Property-based testing shrinking pipeline: step through bisection, element deletion, and scalar decrementing to watch a 10-element random counterexample reduce to the minimal failing input [50]."
    />
  );
}
