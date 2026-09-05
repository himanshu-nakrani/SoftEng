"use client";

import { SectionAlgoFigure } from "@/components/lesson/SectionAlgoFigure";
import { ScenarioView } from "@/engine/algo/views/ScenarioView";
import { zeroDowntimeMigrationAlgo } from "./zero-downtime-migration";

/**
 * The RSC boundary: an AlgoDef carries functions, so the server page imports
 * this wrapper rather than the def. This is also the only place allowed to name
 * a view COMPONENT.
 */
export function ZeroDowntimeMigrationFigure() {
  return (
    <SectionAlgoFigure
      def={zeroDowntimeMigrationAlgo}
      view={ScenarioView}
      description="An on-call decision: migrating a live database column under 1,000 writes per second. Move the slider to make your call between a single ALTER TABLE rename, reading new columns before backfilling, and the expand/contract pattern. The figure runs 200 sub-runs per option under continuous traffic: unthinking renames drop hundreds of writes behind exclusive locks and premature reads crash on unmigrated rows, while expand/contract holds cleanly in all 200 runs."
    />
  );
}
