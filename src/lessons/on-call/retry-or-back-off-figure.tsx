"use client";

import { SectionAlgoFigure } from "@/components/lesson/SectionAlgoFigure";
import { ScenarioView } from "@/engine/algo/views/ScenarioView";
import { retryOrBackOffAlgo } from "./retry-or-back-off";

/**
 * The RSC boundary: an AlgoDef carries functions, so the server page imports
 * this wrapper rather than the def. This is also the only place allowed to name
 * a view COMPONENT.
 */
export function RetryOrBackOffFigure() {
  return (
    <SectionAlgoFigure
      def={retryOrBackOffAlgo}
      view={ScenarioView}
      description="A lock-ordering call. Move the slider to enforce one global order or let each team choose — the figure runs the real interleaving 200 times per option. One order completes every run; the other deadlocks in roughly half of them, and the bars are those measured rates."
    />
  );
}
