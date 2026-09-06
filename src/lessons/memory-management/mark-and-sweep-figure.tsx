"use client";

import { SectionAlgoFigure } from "@/components/lesson/SectionAlgoFigure";
import { GcView } from "@/engine/algo/views/GcView";
import { markAndSweepAlgo } from "./mark-and-sweep";

/**
 * The RSC boundary: an AlgoDef carries functions, so the server page imports
 * this wrapper rather than the def. This is also the only place allowed to name
 * a view COMPONENT.
 */
export function MarkAndSweepFigure() {
  return (
    <SectionAlgoFigure
      def={markAndSweepAlgo}
      view={GcView}
      description="Mark-and-sweep on a four-object heap. 0 always points at 1. The slider picks the heap, 0 through 2, default 0. Heap 0 roots 0; 2 and 3 are garbage: 2 marked, 2 swept, stamp 2 marked 2 swept. Heap 1 adds an unrooted 2↔3 cycle and still marks 2 and sweeps 2. Heap 2 roots 0 and 2 so the cycle is live: 4 marked, 0 swept."
    />
  );
}
