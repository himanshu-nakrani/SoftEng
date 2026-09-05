"use client";

import { SectionAlgoFigure } from "@/components/lesson/SectionAlgoFigure";
import { ThreadsView } from "@/engine/algo/views/ThreadsView";
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
      view={ThreadsView}
      description="TODO: what a reader should watch for, in one or two sentences. This is the figure's accessible description."
    />
  );
}
