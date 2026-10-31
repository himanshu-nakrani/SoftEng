"use client";

import { SectionAlgoFigure } from "@/components/lesson/SectionAlgoFigure";
import { PagingView } from "@/engine/algo/views/PagingView";
import { clockAlgo, fifoAlgo, lruAlgo } from "./page-replacement";

/**
 * The RSC boundary: an AlgoDef carries functions, so the server page imports
 * these wrappers rather than the defs. This is also the only place allowed to
 * name a view COMPONENT.
 */
export function FifoFigure() {
  return (
    <SectionAlgoFigure
      def={fifoAlgo}
      view={PagingView}
      description="Demand paging of pages 0, 1, 2, 0, 3 under FIFO. At the default of three frames, VPN 3 evicts VPN 0 — the page that was just used — leaving frames 3, 1, 2. Four faults, one eviction. Drag to four frames for no eviction, or to two for five faults and three evictions."
    />
  );
}

export function LruFigure() {
  return (
    <SectionAlgoFigure
      def={lruAlgo}
      view={PagingView}
      description="The same five accesses under LRU. At three frames, VPN 3 evicts VPN 1 instead of 0, leaving frames 0, 3, 2. Four faults, one eviction. Recency is why 0 survives: it was used after 1 was."
    />
  );
}

export function ClockFigure() {
  return (
    <SectionAlgoFigure
      def={clockAlgo}
      view={PagingView}
      description="The same five accesses under CLOCK. At three frames CLOCK still evicts VPN 0, matching FIFO: frames 3, 1, 2, four faults, one eviction. Every referenced bit is set at the first eviction, so the second-chance sweep wraps and picks the oldest anyway."
    />
  );
}
