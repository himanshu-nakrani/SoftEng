"use client";

import { SectionAlgoFigure } from "@/components/lesson/SectionAlgoFigure";
import { CryptoView } from "@/engine/algo/views/CryptoView";
import {
  digitalSignaturesAlgo,
  digitalSignaturesTamperAlgo,
} from "./digital-signatures";

/**
 * The RSC boundary: an AlgoDef carries functions, so the server page imports
 * these wrappers rather than the defs. This is also the only place allowed to
 * name a view COMPONENT.
 */
export function DigitalSignaturesFigure() {
  return (
    <SectionAlgoFigure
      def={digitalSignaturesAlgo}
      view={CryptoView}
      description="Toy RSA n=55, e=3, d=27. Default message 4 signs plaintext 5 to signature 25. Verify raises 25 to e and gets 5 back, matching m. The stamp reads verify ok and verified is 1. Drag 1 through 16: every honest run accepts."
    />
  );
}

export function DigitalSignaturesTamperFigure() {
  return (
    <SectionAlgoFigure
      def={digitalSignaturesTamperAlgo}
      view={CryptoView}
      description="The same toy RSA signature, against a message that moved. Default message 4 still signs 5 to 25, but the verifier sees 6. 25 to the e is still 5, which is not 6. The stamp reads verify fail and verified is 0. Drag 1 through 16: every tampered run rejects."
    />
  );
}
