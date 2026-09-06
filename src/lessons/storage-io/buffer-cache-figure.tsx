"use client";

import { SectionAlgoFigure } from "@/components/lesson/SectionAlgoFigure";
import { CacheView } from "@/engine/algo/views/CacheView";
import {
  bufferCacheWritebackAlgo,
  bufferCacheWritethroughAlgo,
} from "./buffer-cache";

/**
 * The RSC boundary: an AlgoDef carries functions, so the server page imports
 * these wrappers rather than the defs. This is also the only place allowed to
 * name a view COMPONENT.
 */
export function WriteBackFigure() {
  return (
    <SectionAlgoFigure
      def={bufferCacheWritebackAlgo}
      view={CacheView}
      defaultSize={2}
      description="Write-back buffer cache on pages a and b, both starting at 0. Two writes (a=1, b=2) then fsync. The slider is where power fails. Default crash 2: both pages dirty in cache, disk still 0, then the crash loses 2. Drag to 3: fsync first, two disk writes, nothing lost."
    />
  );
}

export function WriteThroughFigure() {
  return (
    <SectionAlgoFigure
      def={bufferCacheWritethroughAlgo}
      view={CacheView}
      defaultSize={2}
      description="The same two writes under write-through: every write is a disk write. Default crash 2: lost 0, disk writes 2, disk a=1 b=2. The cache is a copy, not a delay. Drag to 3: fsync finds nothing dirty, disk writes stays 2."
    />
  );
}
