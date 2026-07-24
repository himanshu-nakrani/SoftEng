"use client";

import { SectionFigure } from "@/components/lesson/SectionFigure";
import { cdnSim } from "./cdn";

export function CdnFigure() {
  return (
    <SectionFigure
      sim={cdnSim}
      description="Users in two regions request content through a nearby edge PoP backed by a distant origin. Cache hits return locally in about 80 milliseconds; misses travel to the origin and back in about 700. PoPs can be killed to show regional failover to the origin. Meters show per-region p50 latency, edge hit ratio, and origin load."
    />
  );
}
