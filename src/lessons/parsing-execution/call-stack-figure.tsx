"use client";

import { SectionAlgoFigure } from "@/components/lesson/SectionAlgoFigure";
import { RuntimeView } from "@/engine/algo/views/RuntimeView";
import { callStackAlgo } from "./call-stack";

/**
 * The RSC boundary: an AlgoDef carries functions, so the server page imports
 * this wrapper rather than the def. This is also the only place allowed to name
 * a view COMPONENT.
 */
export function CallStackFigure() {
  return (
    <SectionAlgoFigure
      def={callStackAlgo}
      view={RuntimeView}
      description="A factorial call stack, cap 4. f(n) = n==0 ? 1 : n * f(n-1). Default n=3 returns 6 at depth 4 with 4 pushes and 0 overflow. Drag to 4: overflow at f(0), result null, stamp overflow, then Unwind f(1) through f(4)."
    />
  );
}
