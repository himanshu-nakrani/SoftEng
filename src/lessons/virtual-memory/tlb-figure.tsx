"use client";

import { SectionAlgoFigure } from "@/components/lesson/SectionAlgoFigure";
import { PagingView } from "@/engine/algo/views/PagingView";
import { tlbAlgo, tlbNoneAlgo } from "./tlb";

/**
 * The RSC boundary: an AlgoDef carries functions, so the server page imports
 * these wrappers rather than the defs. This is also the only place allowed to
 * name a view COMPONENT.
 */

export function TlbNoneFigure() {
  return (
    <SectionAlgoFigure
      def={tlbNoneAlgo}
      view={PagingView}
      description="Eight translations of VPN 0 with no TLB. Every access walks the directory then the table: 16 table refs, 0 hits, 0 misses — there is no cache. Drag down to 3: the table-refs meter drops to 6, two per translation."
    />
  );
}

export function TlbFigure() {
  return (
    <SectionAlgoFigure
      def={tlbAlgo}
      view={PagingView}
      description="The same eight translations, with a fully-associative FIFO TLB of 4. The first access misses and walks (2 table refs); the next seven hit and skip the walk. Drag to 3 to see the unit: 1 miss, 2 hits, still 2 table refs."
    />
  );
}
