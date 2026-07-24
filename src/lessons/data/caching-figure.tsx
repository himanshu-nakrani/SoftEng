"use client";

import { SectionFigure } from "@/components/lesson/SectionFigure";
import { cachingSim } from "./caching";

export function CachingFigure() {
  return (
    <SectionFigure
      sim={cachingSim}
      description="An app reading through a cache backed by a slow database. Green packets are cache hits, amber are misses travelling on to the database. Sliders tune cache size, TTL, and read rate; meters show hit ratio, average latency, and database load."
    />
  );
}
