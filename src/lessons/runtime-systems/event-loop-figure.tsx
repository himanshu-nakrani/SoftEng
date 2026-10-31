"use client";

import { SectionAlgoFigure } from "@/components/lesson/SectionAlgoFigure";
import { EventLoopView } from "@/engine/algo/views/EventLoopView";
import { eventLoopAlgo, eventLoopNestedAlgo } from "./event-loop";

/**
 * The RSC boundary: an AlgoDef carries functions, so the server page imports
 * these wrappers rather than the defs. This is also the only place allowed to
 * name a view COMPONENT.
 */
export function EventLoopFigure() {
  return (
    <SectionAlgoFigure
      def={eventLoopAlgo}
      view={EventLoopView}
      description="Three scripts, slider 0 through 2, default 0. Script 0 logs 1, queues micro 2 and macro 3, logs 4: stamp 1,4,2,3, sync 2, micro 1, macro 1. Script 1 is two micros then a timer: stamp 1,5,2,3,4. Script 2 is a nested micro: stamp 1,3,A,B,2."
    />
  );
}

export function EventLoopNestedFigure() {
  return (
    <SectionAlgoFigure
      def={eventLoopNestedAlgo}
      view={EventLoopView}
      description="Script 2, no slider. Log 1, micro A queues micro B, macro 2, log 3. The nested micro still beats the timer: stamp 1,3,A,B,2, micro 2, macro 1."
    />
  );
}
