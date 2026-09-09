"use client";

import { SectionAlgoFigure } from "@/components/lesson/SectionAlgoFigure";
import { ThreadsView } from "@/engine/algo/views/ThreadsView";
import { falseSharingAlgo, paddedAlgo } from "./false-sharing";

export function FalseSharingFigure() {
  return (
    <SectionAlgoFigure
      def={falseSharingAlgo}
      view={ThreadsView}
      description="Two threads increment two different counters that happen to sit on the same cache line. A write only lands if that thread owns the line, so every time the threads alternate one has to take ownership back — visible as a line transfer. Nothing is shared logically, and they still fight."
    />
  );
}

export function PaddedFigure() {
  return (
    <SectionAlgoFigure
      def={paddedAlgo}
      view={ThreadsView}
      description="The same two threads and the same six writes, with the counters padded onto separate lines. Each thread claims its own line once and keeps it, so transfers drop to exactly two however the scheduler interleaves the run."
    />
  );
}
