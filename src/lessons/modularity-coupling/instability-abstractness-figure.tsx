"use client";

import { SectionAlgoFigure } from "@/components/lesson/SectionAlgoFigure";
import { TableView } from "@/engine/algo/views/TableView";
import { instabilityAbstractnessAlgo } from "./instability-abstractness";

/**
 * The RSC boundary: an AlgoDef carries functions, so the server page imports
 * this wrapper rather than the def. This is also the only place allowed to name
 * a view COMPONENT.
 */
export function InstabilityAbstractnessFigure() {
  return (
    <SectionAlgoFigure
      def={instabilityAbstractnessAlgo}
      view={TableView}
      description="Package metrics table showing Afferent Coupling (Ca), Efferent Coupling (Ce), Instability (I), Abstractness (A), and Distance from the Main Sequence (D) as the core package is refactored with abstract interfaces."
    />
  );
}
