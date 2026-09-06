"use client";

import { SectionAlgoFigure } from "@/components/lesson/SectionAlgoFigure";
import { JitView } from "@/engine/algo/views/JitView";
import { deoptimizationAlgo } from "./deoptimization";

/**
 * The RSC boundary: an AlgoDef carries functions, so the server page imports
 * this wrapper rather than the def. This is also the only place allowed to name
 * a view COMPONENT.
 */
export function DeoptimizationFigure() {
  return (
    <SectionAlgoFigure
      def={deoptimizationAlgo}
      view={JitView}
      description="A hot loop of eight iterations. After four interpreted hits the loop compiles; a later iteration fails the type assumption and falls back. The slider is which iteration deopts, 5 through 8, default 6. At 6 the meters read interp 7, compiled 1, deopts 1, and the stamp reads deopt. At 5 — the first compiled iter — compiled is 0. At 8, compiled is 3."
    />
  );
}
