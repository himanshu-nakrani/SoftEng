"use client";

import { SectionAlgoFigure } from "@/components/lesson/SectionAlgoFigure";
import { ThreadsView } from "@/engine/algo/views/ThreadsView";
import { threadPerRequestAlgo, threadPoolAlgo } from "./thread-pools";

export function ThreadPerRequestFigure() {
  return (
    <SectionAlgoFigure
      def={threadPerRequestAlgo}
      view={ThreadsView}
      description="Six requests, six threads, and two database connections. Only two threads can hold a connection, so the rest sit waiting for one — blocking grows from under three turns at four requests to nineteen at eight, while the useful work stays the same."
    />
  );
}

export function ThreadPoolFigure() {
  return (
    <SectionAlgoFigure
      def={threadPoolAlgo}
      view={ThreadsView}
      description="The same six requests through the same two connections, handled by a pool of two workers. Every operation count is identical to the thread-per-request run, but nothing ever blocks: there are exactly as many threads as there are connections to hold."
    />
  );
}
