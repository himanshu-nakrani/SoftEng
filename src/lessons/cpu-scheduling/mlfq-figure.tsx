"use client";

import { SectionAlgoFigure } from "@/components/lesson/SectionAlgoFigure";
import { SchedulerView } from "@/engine/algo/views/SchedulerView";
import { mlfqAgingAlgo, mlfqAlgo } from "./mlfq";

/**
 * The RSC boundary: an AlgoDef carries functions, so the server page imports
 * these wrappers rather than the defs. This is also the only place allowed to
 * name a view COMPONENT.
 */
export function MlfqFigure() {
  return (
    <SectionAlgoFigure
      def={mlfqAlgo}
      view={SchedulerView}
      description="LONG burst 8 and SHORT burst 1 arrive together in Q0, with no aging. SHORT stays in Q0 and finishes at t=2; LONG is demoted twice and finishes at t=9 in Q2. Two demotions, three preemptions."
    />
  );
}

export function MlfqAgingFigure() {
  return (
    <SectionAlgoFigure
      def={mlfqAgingAlgo}
      view={SchedulerView}
      description="The same two tasks, with a boost back to Q0 every age-every steps. At 4, LONG is lifted off Q2 at t=4 and again at t=8, finishes in Q0, and demotions read 4. At 0 or 12 the run matches no aging: LONG ends in Q2 with 2 demotions."
    />
  );
}
