"use client";

import { SectionFigure } from "@/components/lesson/SectionFigure";
import { featureFlagsSim } from "./feature-flags";

export function FeatureFlagsFigure() {
  return (
    <SectionFigure
      sim={featureFlagsSim}
      description="One fleet, one build: every server carries both the old code path (clean) and the new one (which errors on most requests it runs). The FLAG control decides, per request, which path runs — off sends every request down the old path, on (everyone) sends every request down the new path, and on for beta sends only a labelled cohort (about a fifth of requests) down the new path. Cyan dots are requests; a clean reply returns green, an error returns red. Nothing is deployed during the run — the build never changes, only the flag value. With the flag off the new path is dark. The timeline flips the flag on at t=9 and red errors appear at once, then kills it automatically at t=15. Set FLAG to on for beta to expose only the cohort, or press KILL FLAG to send every request back to the old path in one move. Click the new path to kill it outright, so every request routed to it errors."
    />
  );
}
