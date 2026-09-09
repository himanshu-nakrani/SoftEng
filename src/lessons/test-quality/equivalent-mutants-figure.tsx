"use client";

import { SectionAlgoFigure } from "@/components/lesson/SectionAlgoFigure";
import { MutationView } from "@/engine/algo/views/MutationView";
import {
  equivalentMutantsAlgo,
  equivalentMutantsStrengthenedAlgo,
} from "./equivalent-mutants";

/**
 * The RSC boundary: an AlgoDef carries functions, so the server page imports
 * these wrappers rather than the defs. This is also the only file allowed to
 * name the view COMPONENT.
 */
export function PartialSuiteFigure() {
  return (
    <SectionAlgoFigure
      def={equivalentMutantsAlgo}
      view={MutationView}
      description="A score-clamping function under a partial suite. Two of the five mutants are killed and three survive. Two of those survivors are equivalent mutants — no input can tell them from the original — and the third is a real hole the suite simply never probes."
    />
  );
}

export function EveryHoleClosedFigure() {
  return (
    <SectionAlgoFigure
      def={equivalentMutantsStrengthenedAlgo}
      view={MutationView}
      description="The same clamp and the same five mutants under a suite that probes both clamped extremes. All three real holes are killed, and the score plateaus at three of five — the two survivors that remain are the equivalent mutants, which no further test could ever kill."
    />
  );
}
