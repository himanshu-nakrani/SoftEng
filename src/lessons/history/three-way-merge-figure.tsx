"use client";

import { SectionAlgoFigure } from "@/components/lesson/SectionAlgoFigure";
import { RepoView } from "@/engine/algo/views/RepoView";
import {
  threeWayMergeCleanAlgo,
  threeWayMergeFastForwardAlgo,
} from "./three-way-merge";

/**
 * The RSC boundary: an AlgoDef carries functions, so the server page imports
 * this wrapper rather than the def. This is also the only place allowed to name
 * a view COMPONENT.
 */
export function ThreeWayMergeFigure() {
  return (
    <SectionAlgoFigure
      def={threeWayMergeCleanAlgo}
      view={RepoView}
      description="Two diverged branches — main with 'main 1' and feature with 'feat 1' and 'feat 2' — integrated via a three-way merge. Git identifies the merge base commit 'base', combines the non-overlapping edits from both histories, and records a single merge commit with two parents. Five commits now stand where four did, with no history rewritten."
    />
  );
}

export function FastForwardFigure() {
  return (
    <SectionAlgoFigure
      def={threeWayMergeFastForwardAlgo}
      view={RepoView}
      description="Feature work merged when main has not moved past the merge base. Because feature's history contains main's tip in a direct line, git fast-forwards: the main pointer slides to the feature tip and zero new commits are created. The commit count stays at three."
    />
  );
}

export const ThreeWayMergeCleanFigure = ThreeWayMergeFigure;
export const ThreeWayMergeFastForwardFigure = FastForwardFigure;
