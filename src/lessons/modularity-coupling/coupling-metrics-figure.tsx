"use client";

import { SectionAlgoFigure } from "@/components/lesson/SectionAlgoFigure";
import { TableView } from "@/engine/algo/views/TableView";
import { couplingMetricsAlgo } from "./coupling-metrics";

/**
 * The RSC boundary: an AlgoDef carries functions, so the server page imports
 * this wrapper rather than the def. This is also the only place allowed to name
 * a view COMPONENT.
 */
export function CouplingMetricsFigure() {
  return (
    <SectionAlgoFigure
      def={couplingMetricsAlgo}
      view={TableView}
      description="A four-package system (api, billing, orders, db) undergoing modular refactoring. Watch billing's efferent coupling (Ce) fall from 3 to 1 as db is extracted behind a domain interface and dependencies are injected, while db's afferent coupling (Ca) drops from 3 to 2."
    />
  );
}
