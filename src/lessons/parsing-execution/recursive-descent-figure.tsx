"use client";

import { SectionAlgoFigure } from "@/components/lesson/SectionAlgoFigure";
import { ParserView } from "@/engine/algo/views/ParserView";
import {
  recursiveDescentAlgo,
  recursiveDescentFlatAlgo,
} from "./recursive-descent";

/**
 * The RSC boundary: an AlgoDef carries functions, so the server page imports
 * these wrappers rather than the defs. This is also the only place allowed to
 * name a view COMPONENT.
 */
export function PrecFigure() {
  return (
    <SectionAlgoFigure
      def={recursiveDescentAlgo}
      view={ParserView}
      description="A precedence parser: * lives in a tighter production than +. The slider picks one of three expressions, 0 through 2, default 0. Expr 0 is 1+2*3: notes Atom 1, Atom 2, Atom 3, * → 6, + → 7, stamp 7, five reductions. Expr 1 is 1*2+3, stamp 5. Expr 2 is (1+2)*3, stamp 9."
    />
  );
}

export function FlatFigure() {
  return (
    <SectionAlgoFigure
      def={recursiveDescentFlatAlgo}
      view={ParserView}
      description="A flat left-to-right parser. The slider picks one of three expressions, 0 through 2, default 0. Expr 0 is 1+2*3: five reductions, stamp 9, because + and * have the same rank so 1+2 runs first. Expr 1 is 1*2+3, stamp 5. Expr 2 is (1+2)*3, stamp 9."
    />
  );
}
