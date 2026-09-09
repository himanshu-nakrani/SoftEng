"use client";

import { SectionAlgoFigure } from "@/components/lesson/SectionAlgoFigure";
import { ThreadsView } from "@/engine/algo/views/ThreadsView";
import { fencedAlgo, storeBufferAlgo } from "./memory-visibility";

export function StoreBufferFigure() {
  return (
    <SectionAlgoFigure
      def={storeBufferAlgo}
      view={ThreadsView}
      description="Each thread writes its own variable and then reads the other's, but a write lands in a buffer slot and only becomes visible when it is flushed. Shuffle the seed and about one run in three ends with both r1 and r2 reading zero — an outcome that is impossible if writes are visible immediately."
    />
  );
}

export function FencedFigure() {
  return (
    <SectionAlgoFigure
      def={fencedAlgo}
      view={ThreadsView}
      description="The same litmus test with a fence after each store, so the write is published before the thread does anything else. Across two hundred seeds both reads never come back zero: at least one thread always sees the other's write."
    />
  );
}
