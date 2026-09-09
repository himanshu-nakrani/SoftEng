"use client";

import { SectionAlgoFigure } from "@/components/lesson/SectionAlgoFigure";
import { RepoView } from "@/engine/algo/views/RepoView";
import { cherryPickAlgo, revertAlgo } from "./cherry-pick-revert";

/**
 * The RSC boundary: an AlgoDef carries functions, so the server page imports
 * these wrappers rather than the defs. This is also the only place allowed to
 * name a view COMPONENT.
 */

/** Cherry-pick a fix onto main, then merge the branch — the change lands twice. */
export function CherryPickFigure() {
  return (
    <SectionAlgoFigure
      def={cherryPickAlgo}
      view={RepoView}
      description="A commit is cherry-picked from feature onto main as a new commit with a new id; when feature is later merged, the same change arrives a second time, so one logical change ends as two commits."
    />
  );
}

/** Revert a bad commit: a new commit undoes it, the original stays in place. */
export function RevertFigure() {
  return (
    <SectionAlgoFigure
      def={revertAlgo}
      view={RepoView}
      description="A bad commit is reverted by a new commit whose change reverses it; the original stays reachable, so history records both the mistake and its undo."
    />
  );
}
