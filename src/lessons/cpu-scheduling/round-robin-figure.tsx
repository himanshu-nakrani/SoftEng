"use client";

import { SectionAlgoFigure } from "@/components/lesson/SectionAlgoFigure";
import { SchedulerView } from "@/engine/algo/views/SchedulerView";
import { roundRobinAlgo } from "./round-robin";

/**
 * The RSC boundary: an AlgoDef carries functions, so the server page imports
 * this wrapper rather than the def. This is also the only place allowed to
 * name a view COMPONENT.
 */
export function RoundRobinFigure() {
  return (
    <SectionAlgoFigure
      def={roundRobinAlgo}
      view={SchedulerView}
      description="Three tasks A burst 8, B burst 2, C burst 2, round-robin with a switch cost of 1 on every dispatch after the first. At quantum 1, waste is 6, B waits 7, wall time 18. Drag to 2 (waste 3, B waits 3, time 15) and to 8 (waste 2, B waits 9, time 14)."
    />
  );
}
