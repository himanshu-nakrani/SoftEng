"use client";

import { SectionFigure } from "@/components/lesson/SectionFigure";
import { canaryReleasesSim } from "./canary-releases";

export function CanaryReleasesFigure() {
  return (
    <SectionFigure
      sim={canaryReleasesSim}
      // The rollback section has no figure of its own; pressing the roll-back
      // button — wherever it is pressed — completes it.
      completes={[{ on: "button-press", id: "rollback", section: "rollback" }]}
      description="A router splits requests between two versions of one service: v1.4 (stable, in production) and v1.5 (the canary being rolled out, which errors on most requests it receives). The CANARY SHARE slider sets the percentage of traffic sent to v1.5. Cyan dots are requests; a clean reply returns green, an error returns red. At 0% share every request goes to v1.4 and comes back clean. The timeline ships v1.5 to 20% of traffic at t=9, and red errors begin appearing — but only on the canary path, so the overall error rate rises to about a fifth of the version's own failure rate rather than to all of it. Raise the share and the error rate climbs with it; at 100% nearly every request meets the bad version. Click v1.5 to kill it outright (then its share fails completely), or press ROLL BACK to send its traffic home to v1.4 and watch the error rate fall back to the baseline."
    />
  );
}
