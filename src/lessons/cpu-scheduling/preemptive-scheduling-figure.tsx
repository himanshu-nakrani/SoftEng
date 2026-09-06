"use client";

import { SectionAlgoFigure } from "@/components/lesson/SectionAlgoFigure";
import { SchedulerView } from "@/engine/algo/views/SchedulerView";
import {
  preemptiveSchedulingAlgo,
  preemptiveSchedulingPreemptAlgo,
} from "./preemptive-scheduling";

/**
 * The RSC boundary: an AlgoDef carries functions, so the server page imports
 * these wrappers rather than the defs. This is also the only place allowed to
 * name a view COMPONENT.
 */
export function CooperativeFigure() {
  return (
    <SectionAlgoFigure
      def={preemptiveSchedulingAlgo}
      view={SchedulerView}
      description="Three tasks arrive at t=0: A with burst 8, then B and C with burst 2. Cooperative FIFO runs A to completion, so B waits 8 and C waits 10, with zero preemptions."
    />
  );
}

export function PreemptiveFigure() {
  return (
    <SectionAlgoFigure
      def={preemptiveSchedulingPreemptAlgo}
      view={SchedulerView}
      description="The same three tasks, interrupted by a timer every quantum steps. At quantum 1, B waits 3 and C waits 4 after four preemptions. Drag to 2 (B waits 2) and to 8 (identical to cooperative: B waits 8)."
    />
  );
}
