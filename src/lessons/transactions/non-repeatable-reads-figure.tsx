"use client";

import { SectionAlgoFigure } from "@/components/lesson/SectionAlgoFigure";
import { TableView } from "@/engine/algo/views/TableView";
import { nonRepeatableAlgo, repeatableReadAlgo } from "./non-repeatable-reads";

export function NonRepeatableFigure() {
  return (
    <SectionAlgoFigure
      def={nonRepeatableAlgo}
      view={TableView}
      description="T1 reads alice, then bob, then totals them. T2 transfers 50 between the accounts and commits successfully. Under read committed, a commit landing between T1's two reads makes it total an old alice against a new bob — 250 — in about a quarter of runs, with no dirty read anywhere."
    />
  );
}

export function RepeatableReadFigure() {
  return (
    <SectionAlgoFigure
      def={repeatableReadAlgo}
      view={TableView}
      description="The same program at repeatable read. T1 answers every read from the snapshot it started with, so T2's commit is invisible to it and the total is 200 in all two hundred seeds — even though the table genuinely changed underneath."
    />
  );
}
