"use client";

import { SectionAlgoFigure } from "@/components/lesson/SectionAlgoFigure";
import { ThreadsView } from "@/engine/algo/views/ThreadsView";
import { casAlgo, spinLockAlgo } from "./atomic-operations";

export function CasFigure() {
  return (
    <SectionAlgoFigure
      def={casAlgo}
      view={ThreadsView}
      description="Four threads increment a counter with compare-and-swap: read the value, then write only if nobody changed it in between. A thread that loses the race is told so and loops — the failed-attempts counter shows how often that happens. The counter always reaches the number of threads, and no lock is ever taken."
    />
  );
}

export function SpinLockFigure() {
  return (
    <SectionAlgoFigure
      def={spinLockAlgo}
      view={ThreadsView}
      description="A spin lock built from one atomic test-and-set: claim the flag if free, otherwise retry until it is. The same four threads reach the same correct total, but burn far more failed attempts than the compare-and-swap version, because a spinning thread retries while holding nothing useful."
    />
  );
}
