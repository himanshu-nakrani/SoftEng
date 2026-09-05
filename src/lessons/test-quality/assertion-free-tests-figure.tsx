"use client";

import { SectionAlgoFigure } from "@/components/lesson/SectionAlgoFigure";
import { MutationView } from "@/engine/algo/views/MutationView";
import {
  assertionFreeTestsSmokeAlgo,
  assertionFreeTestsAssertedAlgo,
} from "./assertion-free-tests";

/**
 * The RSC boundary: an AlgoDef carries functions, so the server page imports
 * these wrappers rather than the defs. This is also the only place allowed to name
 * a view COMPONENT.
 */
export function SmokeSuiteFigure() {
  return (
    <SectionAlgoFigure
      def={assertionFreeTestsSmokeAlgo}
      view={MutationView}
      description="A shipping rate function under a smoke test suite that executes every line but asserts nothing about the return value. Mutants that crash are killed, but all four calculation mutants survive despite 100% line coverage."
    />
  );
}

export function AssertedSuiteFigure() {
  return (
    <SectionAlgoFigure
      def={assertionFreeTestsAssertedAlgo}
      view={MutationView}
      description="The same shipping rate function and the same six mutants under an asserted suite checking exact fees. All six mutants are killed."
    />
  );
}
