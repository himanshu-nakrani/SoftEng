"use client";

import { SectionAlgoFigure } from "@/components/lesson/SectionAlgoFigure";
import { StorageView } from "@/engine/algo/views/StorageView";
import { btreeAlgo, lsmAlgo } from "./btree-vs-lsm";

/**
 * The RSC boundary: an AlgoDef carries functions, so the server page imports
 * these wrappers rather than the defs. This is also the only place allowed to
 * name a view COMPONENT.
 */
export function BtreeFigure() {
  return (
    <SectionAlgoFigure
      def={btreeAlgo}
      view={StorageView}
      description="A two-level B-tree. Each write walks the root then rewrites the whole leaf that owns the key. At the default of eight keys the page-writes meter reads 8 and the page-reads meter reads 24: height two, paid on every write and on each of the four reads that follow, including a miss for z."
    />
  );
}

export function LsmFigure() {
  return (
    <SectionAlgoFigure
      def={lsmAlgo}
      view={StorageView}
      description="The same eight keys, appended to a memtable of four. Watch two flushes and no compaction: page writes 2, page reads 3, four bloom misses. Drag to twelve keys to force a compaction that merges three runs into one."
    />
  );
}
