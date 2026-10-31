"use client";

import { SectionAlgoFigure } from "@/components/lesson/SectionAlgoFigure";
import { ScenarioView } from "@/engine/algo/views/ScenarioView";
import { cascadingFailureAlgo } from "./cascading-failure";

/**
 * The RSC boundary: an AlgoDef carries functions, so the server page imports
 * this wrapper rather than the def. This is also the only place allowed to name
 * a view COMPONENT.
 */
export function CascadingFailureFigure() {
  return (
    <SectionAlgoFigure
      def={cascadingFailureAlgo}
      view={ScenarioView}
      description="An on-call resilience decision under cache node failure. Move the slider to test stampede mitigation policies across 200 incident seeds. Direct DB passthrough exhausts connection pools and triggers query timeouts (0/200); aggressive retries multiply traffic 3x into total system collapse (0/200); singleflight request coalescing collapses redundant key queries so DB CPU stays under 40% (200/200)."
    />
  );
}
