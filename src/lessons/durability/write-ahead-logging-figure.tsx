"use client";

import { SectionAlgoFigure } from "@/components/lesson/SectionAlgoFigure";
import { WalView } from "@/engine/algo/views/WalView";
import { pagesOnlyAlgo, writeAheadLoggingAlgo } from "./write-ahead-logging";

export function PagesOnlyFigure() {
  return (
    <SectionAlgoFigure
      def={pagesOnlyAlgo}
      view={WalView}
      // Default 4: the torn case. T1 committed, its first page reached disk and
      // its second did not, so the disk holds half a transaction.
      defaultSize={4}
      description="Eight operations with no log, interrupted by a power failure you place with the slider. T1 changes two pages and commits; T2 then starts changing one of them and never finishes. Drag the crash point across the whole range: from the commit onwards the disk contradicts what T1 was told, and it does so in three different ways — the commit missing entirely, half of it present, or T2's uncommitted value left in its place."
    />
  );
}

export function WriteAheadFigure() {
  return (
    <SectionAlgoFigure
      def={writeAheadLoggingAlgo}
      view={WalView}
      // Default 6: the only crash point where recovery has to do both jobs —
      // redo T1's committed work and undo T2's uncommitted page that reached disk.
      defaultSize={6}
      description="The same eight operations, with a log appended before each change and forced once at commit. Watch the record appear above the durability line before the pool moves, and the commit's single fsync carry the record below it. Then crash anywhere: recovery replays T1's committed changes and rolls back T2's, and the disk ends at balance 150 and audit 1 from every crash point after the commit."
    />
  );
}
