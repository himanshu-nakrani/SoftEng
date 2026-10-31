"use client";

import { SectionAlgoFigure } from "@/components/lesson/SectionAlgoFigure";
import { TableView } from "@/engine/algo/views/TableView";
import { cyclicDependenciesAlgo } from "./cyclic-dependencies";

/**
 * The RSC boundary: an AlgoDef carries functions, so the server page imports
 * this wrapper rather than the def. This is also the only place allowed to name
 * a view COMPONENT.
 */
export function CyclicDependenciesFigure() {
  return (
    <SectionAlgoFigure
      def={cyclicDependenciesAlgo}
      view={TableView}
      description="Three packages form a cyclic dependency loop. Tarjan DFS identifies the cycle and topological sort fails. Dependency Inversion extracts UsersInterface, breaking the cycle and computing linear release order [Billing, Users, Orders]."
    />
  );
}
