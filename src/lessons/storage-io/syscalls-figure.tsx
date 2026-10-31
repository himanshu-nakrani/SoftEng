"use client";

import { SectionAlgoFigure } from "@/components/lesson/SectionAlgoFigure";
import { SyscallView } from "@/engine/algo/views/SyscallView";
import { syscallsAlgo, syscallsBatchedAlgo } from "./syscalls";

/**
 * The RSC boundary: an AlgoDef carries functions, so the server page imports
 * these wrappers rather than the defs. This is also the only place allowed to
 * name a view COMPONENT.
 */
export function OneByteFigure() {
  return (
    <SectionAlgoFigure
      def={syscallsAlgo}
      view={SyscallView}
      description="Eight one-byte write() calls. Each is a trap into kernel, a 1-byte copy, and a return. Meters land on 8 traps, 8 copies, 8 bytes. The stamp ends at 8 traps · user. Drag down to 1: one round trip."
    />
  );
}

export function BatchedFigure() {
  return (
    <SectionAlgoFigure
      def={syscallsBatchedAlgo}
      view={SyscallView}
      description="One write() of 8 bytes. One trap, one copy of 8, one return. Meters: 1 trap, 1 copy, 8 bytes. Drag the byte slider: traps stay at 1; only the bytes meter moves."
    />
  );
}
