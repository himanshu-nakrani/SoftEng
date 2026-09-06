"use client";

import { SectionAlgoFigure } from "@/components/lesson/SectionAlgoFigure";
import { PriorityView } from "@/engine/algo/views/PriorityView";
import {
  priorityInversionAlgo,
  priorityInversionInheritAlgo,
} from "./priority-inversion";

/**
 * The RSC boundary: an AlgoDef carries functions, so the server page imports
 * these wrappers rather than the defs. This is also the only place allowed to
 * name a view COMPONENT.
 */
export function InvertedFigure() {
  return (
    <SectionAlgoFigure
      def={priorityInversionAlgo}
      view={PriorityView}
      description="Three tasks, one lock, no inheritance. L burst 5 prio 0 holds the lock; H burst 2 prio 2 needs it; M burst 4 prio 1 does not. Medium preempts Low while High is blocked, so High waits 9, Low waits 4, Medium waits 2."
    />
  );
}

export function InheritFigure() {
  return (
    <SectionAlgoFigure
      def={priorityInversionInheritAlgo}
      view={PriorityView}
      description="The same three tasks with priority inheritance. When High blocks, Low runs at priority 2, Medium cannot preempt, and High waits 5 — only for Low. Low waits 0, Medium waits 7."
    />
  );
}
