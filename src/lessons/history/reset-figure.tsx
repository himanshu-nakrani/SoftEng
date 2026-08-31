"use client";

import { SectionAlgoFigure } from "@/components/lesson/SectionAlgoFigure";
import { RepoView } from "@/engine/algo/views/RepoView";
import { resetAlgo, resetSurviveAlgo } from "./reset";

/**
 * The RSC boundary: an AlgoDef carries functions, so the server page imports
 * these wrappers rather than the defs. This is also the only place allowed to
 * name a view COMPONENT.
 */

/** Reset main back three commits with no safety net — two commits go unreachable. */
export function ResetDiscardFigure() {
  return (
    <SectionAlgoFigure
      def={resetAlgo}
      view={RepoView}
      description="main gains three commits, then git reset --hard moves its pointer back to the first; no commit is created, and the two commits ahead of the new tip go red and dashed because no branch can reach them any more."
    />
  );
}

/** The same reset, but a backup branch was set first, so nothing is orphaned. */
export function ResetSurviveFigure() {
  return (
    <SectionAlgoFigure
      def={resetSurviveAlgo}
      view={RepoView}
      description="Before the same reset, a backup branch is pointed at the tip; when main moves back, the two commits stay reachable through backup, so nothing goes unreachable."
    />
  );
}
