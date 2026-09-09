"use client";

import { SectionAlgoFigure } from "@/components/lesson/SectionAlgoFigure";
import { WalView } from "@/engine/algo/views/WalView";
import { groupCommitAlgo, perCommitAlgo } from "./group-commit";

export function PerCommitFigure() {
  return (
    <SectionAlgoFigure
      def={perCommitAlgo}
      view={WalView}
      // Default 6: every commit has happened, so all three forces are on the
      // meter and the disk shows all three transactions recovered.
      defaultSize={6}
      description="Three transactions, each forcing the log when it commits. Watch the forces meter climb to three, and watch each transaction turn green the moment its own record crosses the durability line. The reward is that a crash at any point keeps everything answered so far; the price is one sequential write per transaction, however many are committing at once."
    />
  );
}

export function GroupCommitFigure() {
  return (
    <SectionAlgoFigure
      def={groupCommitAlgo}
      view={WalView}
      // Default 6: the moment BEFORE the batch force, where all three sit
      // committing and the durable prefix is still empty. That frame is the lesson.
      defaultSize={6}
      description="The identical three transactions, with one force for the batch instead of one each. At crash point 6 all three sit waiting — logically finished, and none of them answered. Drag to 7 and a single fsync carries all six records below the line and answers all three at once. Compare the forces meter: one instead of three, for the same log volume."
    />
  );
}
