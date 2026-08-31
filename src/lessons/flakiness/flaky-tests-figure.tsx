"use client";

import { SectionAlgoFigure } from "@/components/lesson/SectionAlgoFigure";
import { ThreadsView } from "@/engine/algo/views/ThreadsView";
import { flakyTestsAlgo, flakyTestsIsolatedAlgo } from "./flaky-tests";

/**
 * The RSC boundary: an AlgoDef carries functions, so the server page imports
 * these wrappers rather than the defs. This is also the only place allowed to
 * name a view COMPONENT.
 */

export function FlakyTestsFigure() {
  return (
    <SectionAlgoFigure
      def={flakyTestsAlgo}
      view={ThreadsView}
      description="Two tests write and read the same shared slot. Step through the interleaving and watch where the two writes fall relative to the two asserts: when the writes land back to back before an assert, one test reads a value it never wrote and fails. Reseed to draw a different order — the code is identical, only the schedule changed."
    />
  );
}

export function IsolatedTestsFigure() {
  return (
    <SectionAlgoFigure
      def={flakyTestsIsolatedAlgo}
      view={ThreadsView}
      description="The same two tests, but each writes and reads its own slot and resets it afterwards. No interleaving can make one test observe the other's value, so every order passes — at the cost of an extra teardown step per test on every run. Reseed as many times as you like; the verdict never changes."
    />
  );
}
