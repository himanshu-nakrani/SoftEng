"use client";

import { SectionAlgoFigure } from "@/components/lesson/SectionAlgoFigure";
import { CryptoView } from "@/engine/algo/views/CryptoView";
import { hashFunctionsAlgo } from "./hash-functions";

/**
 * The RSC boundary: an AlgoDef carries functions, so the server page imports
 * this wrapper rather than the def. This is also the only place allowed to name
 * a view COMPONENT.
 */
export function HashFunctionsFigure() {
  return (
    <SectionAlgoFigure
      def={hashFunctionsAlgo}
      view={CryptoView}
      description="An 8-bit mixer, mix8 — not SHA-256. Input 42 hashes to 23. The slider is which input bit to flip, 0 through 7, default 0. At 0, six of eight output bits move and the stamp reads 6/8 avalanche."
    />
  );
}
