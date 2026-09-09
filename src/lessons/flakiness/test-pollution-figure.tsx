"use client";

import { SectionAlgoFigure } from "@/components/lesson/SectionAlgoFigure";
import { ThreadsView } from "@/engine/algo/views/ThreadsView";
import {
  testPollutionAlgo,
  testPollutionIsolatedAlgo,
} from "./test-pollution";

/**
 * The RSC boundary: an AlgoDef carries functions, so the server page imports
 * these wrappers rather than the defs. This is also the only place allowed to
 * name a view COMPONENT.
 */

export function TestPollutionFigure() {
  return (
    <SectionAlgoFigure
      def={testPollutionAlgo}
      view={ThreadsView}
      description="Test A inserts a row and then checks the table is non-empty; test B only checks it is non-empty and does no setup of its own. Step through the interleaving: when B's assertion falls before A's insert, B reads an empty table and fails. Reseed to draw a different order — the code is identical, only the schedule changed."
    />
  );
}

export function IsolatedSetupFigure() {
  return (
    <SectionAlgoFigure
      def={testPollutionIsolatedAlgo}
      view={ThreadsView}
      description="The same two tests, but now test B inserts its own row before asserting, so it no longer depends on test A. No order can make B read an empty table, so every schedule passes — at the cost of one extra setup step on B every run. Reseed as many times as you like; the verdict never changes."
    />
  );
}
