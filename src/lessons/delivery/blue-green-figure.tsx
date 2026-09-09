"use client";

import { SectionFigure } from "@/components/lesson/SectionFigure";
import { blueGreenSim } from "./blue-green";

export function BlueGreenFigure() {
  return (
    <SectionFigure
      sim={blueGreenSim}
      // The revert section has no figure of its own; pressing the revert
      // button — wherever it is pressed — completes it.
      completes={[{ on: "button-press", id: "revert", section: "revert" }]}
      description="One router sits in front of two complete fleets: blue v1.4 (the version already in production, which serves cleanly) and green v1.5 (the new version, which errors on most requests it receives). The CUT OVER TO GREEN toggle is a switch, not a share: it sends either 0% or 100% of traffic to green. Cyan dots are requests; a clean reply returns green, an error returns red. At the start every request goes to blue and comes back clean while green sits idle. The timeline cuts the whole fleet over to green at t=9, and within about two seconds the error rate climbs from near zero to roughly 75% — green's own failure rate — because every request now meets the bad version at once. Toggle the switch yourself to see there is no in-between value. Click a fleet to kill it, or press REVERT to flip all traffic straight back to blue in one move and watch the error rate decay as the last requests sent to green drain out."
    />
  );
}
