"use client";

import { SectionAlgoFigure } from "@/components/lesson/SectionAlgoFigure";
import { TableView } from "@/engine/algo/views/TableView";
import { dependencyInversionAlgo } from "./dependency-inversion";

/**
 * The RSC boundary: an AlgoDef carries functions, so the server page imports
 * this wrapper rather than the def. This is also the only place allowed to name
 * a view COMPONENT.
 */
export function DependencyInversionFigure() {
  return (
    <SectionAlgoFigure
      def={dependencyInversionAlgo}
      view={TableView}
      description="Interactive architectural table demonstrating Dependency Inversion: domain fan-out drops from 2 to 0 when port interfaces are extracted, inverting infrastructure dependencies inward and enabling isolated testability."
    />
  );
}
