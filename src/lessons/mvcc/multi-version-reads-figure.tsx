"use client";

import { SectionAlgoFigure } from "@/components/lesson/SectionAlgoFigure";
import { VersionsView } from "@/engine/algo/views/VersionsView";
import { snapshotReadAlgo, writeConflictAlgo } from "./multi-version-reads";

/**
 * The RSC boundary: an AlgoDef carries functions, so the server page imports
 * these wrappers rather than the defs. This is also the only place allowed to
 * name a view COMPONENT.
 */
export function SnapshotReadFigure() {
  return (
    <SectionAlgoFigure
      def={snapshotReadAlgo}
      view={VersionsView}
      description="A report reads two rows while a transfer moves money between them. Each row is a chain of versions, oldest on the left. The report takes a snapshot when it begins and reads the newest version committed before that snapshot — so even when the transfer commits between its two reads, it reads a consistent pair and totals 200. Reshuffle to find a run where the transfer commits between the two reads: the report is ringed on the OLD version, and the newer committed one sits beside it, untouched."
    />
  );
}

export function WriteConflictFigure() {
  return (
    <SectionAlgoFigure
      def={writeConflictAlgo}
      view={VersionsView}
      description="Both transactions read the same balance from their own snapshot and write it back — a deposit and a withdrawal. The first to commit appends a committed version; the second finds that the row it based its write on has changed since its snapshot, and its commit is refused. Its version is struck through in red. Reshuffle: whichever commits first wins, and the loser is always rolled back rather than silently overwritten."
    />
  );
}
