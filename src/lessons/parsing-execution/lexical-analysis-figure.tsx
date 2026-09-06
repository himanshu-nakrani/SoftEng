"use client";

import { SectionAlgoFigure } from "@/components/lesson/SectionAlgoFigure";
import { LexerView } from "@/engine/algo/views/LexerView";
import { lexicalAnalysisAlgo } from "./lexical-analysis";

/**
 * The RSC boundary: an AlgoDef carries functions, so the server page imports
 * this wrapper rather than the def. This is also the only place allowed to name
 * a view COMPONENT.
 */
export function LexicalAnalysisFigure() {
  return (
    <SectionAlgoFigure
      def={lexicalAnalysisAlgo}
      view={LexerView}
      description="A toy scanner. The slider picks one of four sources, 0 through 3, default 0. Source 0 is let n=2: four tokens (kw let, ident n, op =, num 2), one space skipped. Source 1 is let n = 2: the same four tokens, three spaces skipped. Source 2 is let 'n=2': two tokens, the quoted string including =. Source 3 is letn=2: three tokens, letn is one ident not the keyword let."
    />
  );
}
