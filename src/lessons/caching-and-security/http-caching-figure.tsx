"use client";

import { SectionFigure } from "@/components/lesson/SectionFigure";
import { httpCachingSim } from "./http-caching";

export function HttpCachingFigure() {
  return (
    <SectionFigure
      sim={httpCachingSim}
      completes={[
        { on: "param-change", id: "strategy", section: "cache-control-directives" },
        { on: "param-change", id: "ttl", section: "cache-control-directives" },
      ]}
      description="A three-tier caching topology consisting of a browser, a CDN edge node, and an origin database. Under no-cache, every request traverses all two wire legs to the origin, paying a full 700ms round trip and loading the origin with 7 requests. Under max-age=4, repeated requests within the TTL window hit the browser's local memory with 0ms latency, raising the hit rate to 63% and cutting average latency to 256ms. Switching to stale-while-revalidate serves stale content instantly (88% hit rate, 58ms average latency) while refreshing the origin in the background."
    />
  );
}
