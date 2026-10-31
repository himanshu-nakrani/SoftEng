"use client";

import { SectionAlgoFigure } from "@/components/lesson/SectionAlgoFigure";
import { RuntimeView } from "@/engine/algo/views/RuntimeView";
import {
  treeWalkVsBytecodeAlgo,
  treeWalkVsBytecodeBcAlgo,
} from "./tree-walk-vs-bytecode";

/**
 * The RSC boundary: an AlgoDef carries functions, so the server page imports
 * these wrappers rather than the defs. This is also the only place allowed to
 * name a view COMPONENT.
 */
export function WalkFigure() {
  return (
    <SectionAlgoFigure
      def={treeWalkVsBytecodeAlgo}
      view={RuntimeView}
      description="A tree-walk evaluator. The slider picks one of three expressions, 0 through 2, default 1. Default 1 is 1+2*3: five visits, stamp 7. Expr 0 is 1+2: three visits, stamp 3. Expr 2 is (1+2)*3: five visits, stamp 9."
    />
  );
}

export function BytecodeFigure() {
  return (
    <SectionAlgoFigure
      def={treeWalkVsBytecodeBcAlgo}
      view={RuntimeView}
      description="A stack bytecode evaluator of the same three expressions, 0 through 2, default 1. Default 1 is 1+2*3: LOAD 1, LOAD 2, LOAD 3, MUL, ADD — five ops, stack max 3, stamp 7. Last notes: MUL. stack [1 6]. / ADD. stack [7]. / 1+2*3 = 7. stack max 3. Drag to 2: (1+2)*3 is 9 with stack max 2."
    />
  );
}
