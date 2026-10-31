"use client";

import { SectionAlgoFigure } from "@/components/lesson/SectionAlgoFigure";
import { MutationView } from "@/engine/algo/views/MutationView";
import {
  brittleMocksMockAlgo,
  brittleMocksStateAlgo,
} from "./brittle-mocks";

/**
 * The RSC boundary: an AlgoDef carries functions, so the server page imports
 * these wrappers rather than the defs. This is also the only place allowed to name
 * a view COMPONENT.
 */
export function MockSuiteFigure() {
  return (
    <SectionAlgoFigure
      def={brittleMocksMockAlgo}
      view={MutationView}
      description="An order processing function under a mock-heavy suite asserting spy call counts, event names, and order. The three safe internal refactorings fail (false positives), while the three real calculation bugs survive undetected."
    />
  );
}

export function StateSuiteFigure() {
  return (
    <SectionAlgoFigure
      def={brittleMocksStateAlgo}
      view={MutationView}
      description="The same order processing function and the same six mutants under a state-verification suite. The three internal refactorings pass cleanly, while all three calculation bugs are killed."
    />
  );
}
