"use client";

import { SectionAlgoFigure } from "@/components/lesson/SectionAlgoFigure";
import { ScenarioView } from "@/engine/algo/views/ScenarioView";
import { threadPoolSizingAlgo } from "./thread-pool-sizing";

/**
 * The RSC boundary: an AlgoDef carries functions, so the server page imports
 * this wrapper rather than the def. This is also the only place allowed to name
 * a view COMPONENT.
 */
export function ThreadPoolSizingFigure() {
  return (
    <SectionAlgoFigure
      def={threadPoolSizingAlgo}
      view={ScenarioView}
      description="An on-call decision. Move the slider to test each policy — expand threads, buffer in a deep unbounded queue, or keep pool bounded and shed excess — against 200 simulated runs during a downstream latency spike from 10ms to 400ms. Expanding threads thrashes CPU; unbounded queueing explodes latency to 30s; bounding the pool and shedding excess holds latency at 400ms and preserves throughput in all 200 runs."
    />
  );
}
