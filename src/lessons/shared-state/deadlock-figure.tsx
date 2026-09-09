"use client";

import { SectionAlgoFigure } from "@/components/lesson/SectionAlgoFigure";
import { ThreadsView } from "@/engine/algo/views/ThreadsView";
import { deadlockAlgo, deadlockOrderedAlgo } from "./deadlock";

export function DeadlockFigure() {
  return (
    <SectionAlgoFigure
      def={deadlockAlgo}
      view={ThreadsView}
      description="Two transfers between the same two accounts, each taking both account locks. T1 locks A then B; T2 locks B then A. At the default seed both threads take their first lock before either takes its second, so each waits forever for a lock the other holds — the run stops on a deadlock frame. Reseed to find interleavings that complete instead."
    />
  );
}

export function DeadlockOrderedFigure() {
  return (
    <SectionAlgoFigure
      def={deadlockOrderedAlgo}
      view={ThreadsView}
      description="The same two transfers, but both threads now acquire lock A before lock B. The waiting is still there — one thread blocks while the other holds A — but a cycle is impossible, so every interleaving completes and both balances return to 100."
    />
  );
}
