"use client";

import { SectionAlgoFigure } from "@/components/lesson/SectionAlgoFigure";
import { ScenarioView } from "@/engine/algo/views/ScenarioView";
import { circuitBreakerHysteresisAlgo } from "./circuit-breaker-hysteresis";

/**
 * The RSC boundary: an AlgoDef carries functions, so the server page imports
 * this wrapper rather than the def. This is also the only place allowed to name
 * a view COMPONENT.
 */
export function CircuitBreakerHysteresisFigure() {
  return (
    <SectionAlgoFigure
      def={circuitBreakerHysteresisAlgo}
      view={ScenarioView}
      description="An on-call recovery decision. Move the slider to test each recovery probing policy across 200 incident seeds. Immediate full close traps the flapping dependency in an unending crash loop (0/200); a fixed 60-second cooldown leaves healthy capacity idle (100/200); half-open probing with rate-ramping recovers cleanly in all 200 runs."
    />
  );
}
