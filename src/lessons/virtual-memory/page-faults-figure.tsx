"use client";

import { SectionAlgoFigure } from "@/components/lesson/SectionAlgoFigure";
import { PagingView } from "@/engine/algo/views/PagingView";
import { pageFaultsAlgo } from "./page-faults";

/**
 * The RSC boundary: an AlgoDef carries functions, so the server page imports
 * this wrapper rather than the def. This is also the only place allowed to name
 * a view COMPONENT.
 */
export function PageFaultsFigure() {
  return (
    <SectionAlgoFigure
      def={pageFaultsAlgo}
      view={PagingView}
      description="Demand paging with four frames and no eviction. Every PTE starts invalid. At two unique pages the run is VPN 0, 1, then 0 again: two faults, two disk reads, six table refs, and the repeat does not fault. Drag to four: faults equal unique pages, disk reads match, and evictions stay at zero even when every frame is full."
    />
  );
}
