"use client";

import { SectionAlgoFigure } from "@/components/lesson/SectionAlgoFigure";
import { ScenarioView } from "@/engine/algo/views/ScenarioView";
import { splitBrainPartitionAlgo } from "./split-brain-partition";

/**
 * The RSC boundary: an AlgoDef carries functions, so the server page imports
 * this wrapper rather than the def. This is also the only place allowed to name
 * a view COMPONENT.
 */
export function SplitBrainPartitionFigure() {
  return (
    <SectionAlgoFigure
      def={splitBrainPartitionAlgo}
      view={ScenarioView}
      description="A network partition decision in a 3-node cluster. Move the slider to test each partition handling policy across 200 incident seeds. Allowing both sides to write causes catastrophic data loss upon healing (0/200 safe); freezing all writes drops availability to 0% (0/200 meet SLA); majority quorum with fencing commits writes safely on the majority side while fencing the isolated node, with 0 lost writes in 200/200 runs."
    />
  );
}
