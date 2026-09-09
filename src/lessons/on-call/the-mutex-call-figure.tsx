"use client";

import { SectionAlgoFigure } from "@/components/lesson/SectionAlgoFigure";
import { ScenarioView } from "@/engine/algo/views/ScenarioView";
import { theMutexCallAlgo } from "./the-mutex-call";

/**
 * The RSC boundary: an AlgoDef carries functions, so the server page imports
 * this wrapper rather than the def. This is also the only place allowed to name
 * a view COMPONENT.
 */
export function TheMutexCallFigure() {
  return (
    <SectionAlgoFigure
      def={theMutexCallAlgo}
      view={ScenarioView}
      description="An on-call decision. Move the slider to make your call — leave the race or take the lock — and the figure runs the real interleaving 200 times for each option, so the bars are measured pass rates, not asserted ones. Leaving it stays correct in only a fraction of runs; the lock in all of them."
    />
  );
}
