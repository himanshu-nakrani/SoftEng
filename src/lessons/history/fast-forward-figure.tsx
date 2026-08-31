"use client";

import { SectionAlgoFigure } from "@/components/lesson/SectionAlgoFigure";
import { RepoView } from "@/engine/algo/views/RepoView";
import { fastForwardAlgo, fastForwardDivergedAlgo } from "./fast-forward";

/**
 * The RSC boundary: an AlgoDef carries functions, so the server page imports
 * this wrapper rather than the def. This is also the only place allowed to name
 * a view COMPONENT.
 */
export function FastForwardFigure() {
  return (
    <SectionAlgoFigure
      def={fastForwardAlgo}
      view={RepoView}
      description="feature is two commits ahead of main and main has not moved since the branch point. git merge feature has no divergence to reconcile, so it fast-forwards: the main pointer slides to the feature tip and no commit is created. The graph ends with three commits, exactly the number that existed before the merge ran."
    />
  );
}

export function NoFastForwardFigure() {
  return (
    <SectionAlgoFigure
      def={fastForwardDivergedAlgo}
      view={RepoView}
      description="The same feature work, but this time main gained a hotfix commit after the branch point, so the histories have diverged. The identical git merge feature can no longer slide along a straight line; it records a two-parent merge commit, and the graph grows from four commits to five."
    />
  );
}
