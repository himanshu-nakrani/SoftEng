"use client";

import { SectionAlgoFigure } from "@/components/lesson/SectionAlgoFigure";
import { TableView } from "@/engine/algo/views/TableView";
import { stranglerFigAlgo } from "./strangler-fig";

/**
 * The RSC boundary: an AlgoDef carries functions, so the server page imports
 * this wrapper rather than the def. This is also the only place allowed to name
 * a view COMPONENT.
 */
export function StranglerFigFigure() {
  return (
    <SectionAlgoFigure
      def={stranglerFigAlgo}
      view={TableView}
      description="A four-route monolithic system (/catalog, /orders, /payments, /users) migrating to microservices via the Strangler Fig pattern. Observe the facade proxy redirecting traffic route by route, reducing monolith traffic from 100% to 0% with zero downtime."
    />
  );
}
