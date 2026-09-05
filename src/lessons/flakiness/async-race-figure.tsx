"use client";

import { SectionAlgoFigure } from "@/components/lesson/SectionAlgoFigure";
import { ThreadsView } from "@/engine/algo/views/ThreadsView";
import {
  asyncRaceAwaitingAlgo,
  asyncRaceSleepAlgo,
} from "./async-race";

/**
 * The RSC boundary: an AlgoDef carries functions, so the server page imports
 * these wrappers rather than the defs. This is also the only place allowed to
 * name a view COMPONENT.
 */

export function AsyncRaceSleepFigure() {
  return (
    <SectionAlgoFigure
      def={asyncRaceSleepAlgo}
      view={ThreadsView}
      description="The test runner sleeps for an arbitrary duration and asserts ready == 1. Step through the interleaving: when the scheduler delays the worker or switches back to the test first, the test wakes and asserts before the write lands, failing. Reseed to see the outcome flip under identical code."
    />
  );
}

export function AsyncRaceAwaitingFigure() {
  return (
    <SectionAlgoFigure
      def={asyncRaceAwaitingAlgo}
      view={ThreadsView}
      description="The test runner awaits the condition ready == 1 before asserting. The test thread is parked until the worker completes its write, guaranteeing that every interleaving order passes. Reseed as many times as you like; the verdict never fails."
    />
  );
}

/** Default figure export / alias for single-figure references. */
export const AsyncRaceFigure = AsyncRaceSleepFigure;
