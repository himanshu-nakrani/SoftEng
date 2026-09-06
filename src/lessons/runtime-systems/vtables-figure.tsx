"use client";

import { SectionAlgoFigure } from "@/components/lesson/SectionAlgoFigure";
import { VtableView } from "@/engine/algo/views/VtableView";
import {
  vtablesAlgo,
  vtablesItableAlgo,
  vtablesStaticAlgo,
} from "./vtables";

/**
 * The RSC boundary: an AlgoDef carries functions, so the server page imports
 * these wrappers rather than the defs. This is also the only place allowed to
 * name a view COMPONENT.
 */
export function StaticFigure() {
  return (
    <SectionAlgoFigure
      def={vtablesStaticAlgo}
      view={VtableView}
      description="Static dispatch. The slider is the object, 0 dog or 1 cat, default 0. Dog calls Dog_speak → woof with 0 lookups. Cat calls Cat_speak → meow, still 0 lookups. There is no table."
    />
  );
}

export function VtableFigure() {
  return (
    <SectionAlgoFigure
      def={vtablesAlgo}
      view={VtableView}
      description="A class vtable. The slider is the object, 0 dog or 1 cat, default 0. Load vptr, then slot 0: 2 lookups. Dog → Dog_speak → woof. Cat → Cat_speak → meow. Same call site, two tables."
    />
  );
}

export function ItableFigure() {
  return (
    <SectionAlgoFigure
      def={vtablesItableAlgo}
      view={VtableView}
      description="An interface itable on dog. The slider is which slot holds speak, 0 through 2, default 2. Slot 0 scans 1 (lookups 2). Slot 2 scans draw, clone, speak: 3 scans, 4 lookups, still woof."
    />
  );
}
