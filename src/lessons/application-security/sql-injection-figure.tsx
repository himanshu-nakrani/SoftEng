"use client";

import { SectionAlgoFigure } from "@/components/lesson/SectionAlgoFigure";
import { InjectView } from "@/engine/algo/views/InjectView";
import { sqlInjectionAlgo, sqlInjectionParamAlgo } from "./sql-injection";

/**
 * The RSC boundary: an AlgoDef carries functions, so the server page imports
 * these wrappers rather than the defs. This is also the only place allowed to
 * name a view COMPONENT.
 */
export function ConcatFigure() {
  return (
    <SectionAlgoFigure
      def={sqlInjectionAlgo}
      view={InjectView}
      description="Concatenating payload 1 (7 OR 1=1) into the query adds an OR taint node and returns 3 rows — ids 1, 7, and 9. injected 1. Drag to payload 0 for a single match on id 7."
    />
  );
}

export function ParamFigure() {
  return (
    <SectionAlgoFigure
      def={sqlInjectionParamAlgo}
      view={InjectView}
      description="Binding payload 1 (7 OR 1=1) as a parameter keeps the whole string a literal leaf. 0 rows. injected 0. Drag to payload 0 to match id 7 once."
    />
  );
}
