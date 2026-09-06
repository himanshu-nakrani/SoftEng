"use client";

import { SectionAlgoFigure } from "@/components/lesson/SectionAlgoFigure";
import { GcView } from "@/engine/algo/views/GcView";
import { incrementalGcAlgo, incrementalGcSlicedAlgo } from "./incremental-gc";

/**
 * The RSC boundary: an AlgoDef carries functions, so the server page imports
 * these wrappers rather than the defs. This is also the only place allowed to
 * name a view COMPONENT.
 */
export function IncrementalGcFigure() {
  return (
    <SectionAlgoFigure
      def={incrementalGcAlgo}
      view={GcView}
      description="Four live objects a→b→c→d, rooted at a. Stop-the-world marks all four in one pause of 4: pause 4, slices 1, marked 4. The last caption is One pause of 4. The stamp reads pause 4."
    />
  );
}

export function IncrementalGcSlicedFigure() {
  return (
    <SectionAlgoFigure
      def={incrementalGcSlicedAlgo}
      view={GcView}
      description="The same four live objects, marked in slices. The slider is the budget, 1 through 4, default 1. At 1: pause 1, four slices, stamp max 1 × 4. Drag to 4: pause 4, one slice — the same as stop-the-world. Pause is the longest slice, not the total work."
    />
  );
}
