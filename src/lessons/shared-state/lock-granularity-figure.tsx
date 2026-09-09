"use client";

import { SectionAlgoFigure } from "@/components/lesson/SectionAlgoFigure";
import { ThreadsView } from "@/engine/algo/views/ThreadsView";
import { coarseLockAlgo, fineLockAlgo } from "./lock-granularity";

export function CoarseLockFigure() {
  return (
    <SectionAlgoFigure
      def={coarseLockAlgo}
      view={ThreadsView}
      description="Four threads increment two independent counters — two threads on each — but a single lock covers both. Threads that share no data still queue behind one another, and the number of blocked turns grows with the square of the threads sharing the lock."
    />
  );
}

export function FineLockFigure() {
  return (
    <SectionAlgoFigure
      def={fineLockAlgo}
      view={ThreadsView}
      description="The same four threads and the same work, but each counter has its own lock. Threads touching different counters no longer block each other, cutting blocked turns from six to two while executing exactly the same twelve operations."
    />
  );
}
