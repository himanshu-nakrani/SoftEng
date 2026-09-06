"use client";

import { SectionAlgoFigure } from "@/components/lesson/SectionAlgoFigure";
import { JitView } from "@/engine/algo/views/JitView";
import { jitCompilationAlgo } from "./jit-compilation";

/**
 * The RSC boundary: an AlgoDef carries functions, so the server page imports
 * this wrapper rather than the def. This is also the only place allowed to name
 * a view COMPONENT.
 */
export function JitCompilationFigure() {
  return (
    <SectionAlgoFigure
      def={jitCompilationAlgo}
      view={JitView}
      description="A hot loop. After 4 interpreted hits the loop compiles; later iterations run compiled. Default 8 iterations: interp 4, compiles 1, compiled 4, stamp 4 compiled. Drag to 4: the compile fires but compiled stays 0. Drag to 3: never compiles. This lesson never deopts."
    />
  );
}
