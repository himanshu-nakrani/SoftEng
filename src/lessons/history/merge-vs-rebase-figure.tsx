"use client";

import { SectionAlgoFigure } from "@/components/lesson/SectionAlgoFigure";
import { RepoView } from "@/engine/algo/views/RepoView";
import { mergeVsRebaseAlgo, mergeVsRebaseRebasedAlgo } from "./merge-vs-rebase";

/**
 * The RSC boundary: an AlgoDef carries functions, so the server page imports
 * this wrapper rather than the def. This is also the only place allowed to name
 * a view COMPONENT.
 */
export function MergeFigure() {
  return (
    <SectionAlgoFigure
      def={mergeVsRebaseAlgo}
      view={RepoView}
      description="The same divergent history — one commit on main after the branch point, two on feature — integrated with git merge. The final frame adds a single merge commit whose two parents are the tips of both branches, so five commits stand where four did and no earlier commit is touched. Nothing is orphaned; both lines of history remain reachable."
    />
  );
}

export function RebaseFigure() {
  return (
    <SectionAlgoFigure
      def={mergeVsRebaseRebasedAlgo}
      view={RepoView}
      description="The identical work integrated with git rebase. Instead of one merge commit it makes two new copies of the feature commits, chained onto the tip of main and given fresh ids. The two originals are drawn dashed and hollow because no branch can reach them any more — the history is linear, but the commits you had are gone and replaced."
    />
  );
}
