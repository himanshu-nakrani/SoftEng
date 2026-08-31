"use client";

import { SectionAlgoFigure } from "@/components/lesson/SectionAlgoFigure";
import { WalView } from "@/engine/algo/views/WalView";
import { checkpointsAlgo, noCheckpointAlgo } from "./checkpoints";

export function NoCheckpointFigure() {
  return (
    <SectionAlgoFigure
      def={noCheckpointAlgo}
      view={WalView}
      // Default 9: the deepest crash, where the log is longest and the gap
      // between the two policies is widest.
      defaultSize={9}
      description="Ten operations with a write-ahead log and no checkpoint. Three transactions commit and a fourth never does. Because no page is ever forced out during normal running, the disk still holds the values it started with when the power fails — so redo has to consider all eight durable records and replay four of them. Correct, but the work grows with the length of the log."
    />
  );
}

export function CheckpointFigure() {
  return (
    <SectionAlgoFigure
      def={checkpointsAlgo}
      view={WalView}
      defaultSize={9}
      description="The identical ten operations, taking the checkpoint at operation 5. Every dirty page is forced, so redo may begin at the checkpoint record: five records considered instead of eight, and two replayed instead of four — though the records-applied meter reads 3, because the checkpoint also created an undo. Watch what it cost — three page writes during normal running, and an undo of T4's uncommitted value, which the checkpoint itself put on disk."
    />
  );
}
