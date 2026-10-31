"use client";

import { SectionAlgoFigure } from "@/components/lesson/SectionAlgoFigure";
import { PagingView } from "@/engine/algo/views/PagingView";
import {
  addressTranslationAlgo,
  addressTranslationSameTableAlgo,
} from "./address-translation";

/**
 * The RSC boundary: an AlgoDef carries functions, so the server page imports
 * these wrappers rather than the defs. This is also the only place allowed to
 * name a view COMPONENT.
 */
export function AddressTranslationFigure() {
  return (
    <SectionAlgoFigure
      def={addressTranslationAlgo}
      view={PagingView}
      description="Identity-mapped 16-page address space, no TLB. Default three translations — VPNs 0, 4, 8 — walk directory then table and land at 6 table refs with 0 faults. Drag to 4 to light every directory slot (8 refs); drag to 8 and the meter reads 16, still no faults."
    />
  );
}

export function AddressTranslationSameTableFigure() {
  return (
    <SectionAlgoFigure
      def={addressTranslationSameTableAlgo}
      view={PagingView}
      description="The same identity map, walking VPNs 0, 1, 2 inside one table. Directory slot 0–3 stays lit. At three translations the table-refs meter still reads 6 and faults stay at 0 — locality does not discount the walk. Drag to 8: sixteen refs, the same four pages twice."
    />
  );
}
