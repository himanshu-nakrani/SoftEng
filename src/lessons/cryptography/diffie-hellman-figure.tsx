"use client";

import { SectionAlgoFigure } from "@/components/lesson/SectionAlgoFigure";
import { CryptoView } from "@/engine/algo/views/CryptoView";
import { diffieHellmanAlgo } from "./diffie-hellman";

/**
 * The RSC boundary: an AlgoDef carries functions, so the server page imports
 * this wrapper rather than the def. This is also the only place allowed to name
 * a view COMPONENT.
 */
export function DiffieHellmanFigure() {
  return (
    <SectionAlgoFigure
      def={diffieHellmanAlgo}
      view={CryptoView}
      description="Alice's secret starts at 6, Bob's is 7. They publish 8 and 17 and both land on shared secret 12 after 18 modular multiplies. The guesses meter is 23: Eve's brute-force bound is p. Drag Alice's secret from 2 to 10: the public value A changes, B stays 17, and both sides still match."
    />
  );
}
