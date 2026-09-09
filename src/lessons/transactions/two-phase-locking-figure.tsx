"use client";

import { SectionAlgoFigure } from "@/components/lesson/SectionAlgoFigure";
import { TableView } from "@/engine/algo/views/TableView";
import { optimisticAlgo, twoPhaseLockingAlgo } from "./two-phase-locking";

export function OptimisticFigure() {
  return (
    <SectionAlgoFigure
      def={optimisticAlgo}
      view={TableView}
      description="The lost-update program at serializable, enforced optimistically: both transactions read a snapshot, work independently, and the second to commit is refused because the balance it read has changed. Both transactions commit in only 49 of 200 runs, and nobody ever waits."
    />
  );
}

export function TwoPhaseLockingFigure() {
  return (
    <SectionAlgoFigure
      def={twoPhaseLockingAlgo}
      view={TableView}
      description="The same program enforced pessimistically. The read takes an exclusive lock on the row and holds it until commit, so the second transaction waits rather than failing — watch a lane read 'waiting for balance'. Both transactions commit in all 200 runs and the balance is 120 every time, at the cost of blocking in every run."
    />
  );
}
