"use client";

import { SectionAlgoFigure } from "@/components/lesson/SectionAlgoFigure";
import { JournalView } from "@/engine/algo/views/JournalView";
import { fsJournalingAlgo, fsJournalingUnorderedAlgo } from "./fs-journaling";

/**
 * The RSC boundary: an AlgoDef carries functions, so the server page imports
 * these wrappers rather than the defs. This is also the only place allowed to
 * name a view COMPONENT.
 */
export function UnorderedFigure() {
  return (
    <SectionAlgoFigure
      def={fsJournalingUnorderedAlgo}
      view={JournalView}
      defaultSize={1}
      description="Create a file with two disk writes and no journal: data block 0, then the inode. The slider is where power fails. Default crash 1: data on disk is b0, the inode is empty, and the block is an orphan. Drag to 2 and the inode names 0."
    />
  );
}

export function JournaledFigure() {
  return (
    <SectionAlgoFigure
      def={fsJournalingAlgo}
      view={JournalView}
      defaultSize={3}
      description="The same create, with the inode change appended to a journal and forced before the inode is written. Default crash 3: after the force, before the inode write. Recovery replays the forced record so the inode names 0 and the block is not an orphan. Drag to 2: the record is unforced, recovery does not run, still an orphan. The data block is never in the journal."
    />
  );
}
