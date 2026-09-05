"use client";

import { SectionAlgoFigure } from "@/components/lesson/SectionAlgoFigure";
import { RefactorView } from "@/engine/algo/views/RefactorView";
import {
  replaceConditionalAlgo,
  replaceConditionalPolymorphicAlgo,
} from "./replace-conditional";

/**
 * The RSC boundary: an AlgoDef carries functions, so the server page imports
 * this wrapper rather than the def. This is also the only place allowed to name
 * a view COMPONENT.
 */
export function ReplaceConditionalFigure() {
  return (
    <SectionAlgoFigure
      def={replaceConditionalAlgo}
      view={RefactorView}
      description="A type-dispatching conditional calculating shipping fees opens at cyclomatic complexity 6. Step through each strategy extraction and watch the dispatcher shed its decision branches until every function in the module reaches complexity 1 under polymorphic dispatch."
    />
  );
}

export function ReplaceConditionalPolymorphicFigure() {
  return (
    <SectionAlgoFigure
      def={replaceConditionalPolymorphicAlgo}
      view={RefactorView}
      description="The open-closed principle in action: adding a new SameDay shipping strategy creates a standalone class of complexity 1 without modifying the dispatcher or any existing strategy classes."
    />
  );
}
