"use client";

import { SectionAlgoFigure } from "@/components/lesson/SectionAlgoFigure";
import { GcView } from "@/engine/algo/views/GcView";
import {
  generationalGcAlgo,
  generationalGcBarrierAlgo,
} from "./generational-gc";

/**
 * The RSC boundary: an AlgoDef carries functions, so the server page imports
 * these wrappers rather than the defs. This is also the only place allowed to
 * name a view COMPONENT.
 */
export function NoBarrierFigure() {
  return (
    <SectionAlgoFigure
      def={generationalGcAlgo}
      view={GcView}
      description="Minor GC of young Y0 (rooted), Y1, and old O0 (rooted), with no write barrier. Default 1 stores O0.p = Y1. The collector marks only Y0, then sweeps live Y1: lost 1, swept 1, stamp lost Y1. Drag to 0: Y1 is garbage, lost 0, swept 1."
    />
  );
}

export function BarrierFigure() {
  return (
    <SectionAlgoFigure
      def={generationalGcBarrierAlgo}
      view={GcView}
      description="The same heap and store, with a write barrier. Default 1 dirties card O0. Minor GC marks Y0 and Y1: cards 1, marked 2, lost 0, swept 0, stamp held. Drag to 0: no store, no card, Y1 is garbage, swept 1."
    />
  );
}
