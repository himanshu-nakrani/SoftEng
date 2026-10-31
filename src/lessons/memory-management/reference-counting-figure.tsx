"use client";

import { SectionAlgoFigure } from "@/components/lesson/SectionAlgoFigure";
import { GcView } from "@/engine/algo/views/GcView";
import {
  referenceCountingAlgo,
  referenceCountingCycleAlgo,
} from "./reference-counting";

/**
 * The RSC boundary: an AlgoDef carries functions, so the server page imports
 * these wrappers rather than the defs. This is also the only place allowed to
 * name a view COMPONENT.
 */
export function AcyclicFigure() {
  return (
    <SectionAlgoFigure
      def={referenceCountingAlgo}
      view={GcView}
      description="Two objects. A.p=B, then drop both. Skip to the end: allocs 2, freed 2, leaked 0. The last caption is Both freed. Stamp 2 freed."
    />
  );
}

export function CycleFigure() {
  return (
    <SectionAlgoFigure
      def={referenceCountingCycleAlgo}
      view={GcView}
      description="The same two objects, now A↔B, then drop both. Skip to the end: allocs 2, freed 0, leaked 2. The last caption is Leaked 2. rc never hit 0. Stamp 2 leaked."
    />
  );
}
