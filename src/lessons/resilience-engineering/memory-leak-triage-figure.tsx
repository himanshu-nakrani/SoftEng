"use client";

import { SectionAlgoFigure } from "@/components/lesson/SectionAlgoFigure";
import { ScenarioView } from "@/engine/algo/views/ScenarioView";
import { memoryLeakTriageAlgo } from "./memory-leak-triage";

/**
 * The RSC boundary: an AlgoDef carries functions, so the server page imports
 * this wrapper rather than the def. This is also the only place allowed to name
 * a view COMPONENT.
 */
export function MemoryLeakTriageFigure() {
  return (
    <SectionAlgoFigure
      def={memoryLeakTriageAlgo}
      view={ScenarioView}
      description="Triage an impending out-of-memory crash: compare dropped requests and SLA compliance across simultaneous restart, waiting for OOM-kill, and rolling graceful drain."
    />
  );
}
