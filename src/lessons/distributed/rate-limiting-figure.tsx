"use client";

import { SectionFigure } from "@/components/lesson/SectionFigure";
import type { SimSnapshot } from "@/engine/snapshot";
import { rateLimitingSim } from "./rate-limiting";

/* Node-local geometry, in the 88x60 box SystemNode draws in. The free band is
   y 26..46 across x 6..82; the label sits centered around x 23..65, so the
   gauge tucks into the left margin, flush with the load bar's x=12 edge. */
const GAUGE_X = 12;
const GAUGE_Y = 26;
const GAUGE_W = 7;
const GAUGE_H = 20;

function metaNumber(
  meta: Record<string, unknown> | undefined,
  key: string,
  fallback: number,
): number {
  const value = meta?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/**
 * The bucket, drawn where the bucket actually is. A vertical fill inside the
 * limiter node: tokens / bucket size, anchored at the bottom so it reads as a
 * *level* (a thing that drains and refills) rather than a progress bar. The
 * scaleY transform is what CSS interpolates between 10Hz snapshots — same
 * discipline as the load bar underneath it.
 */
function TokenGauge({ runtime }: { runtime: SimSnapshot["nodes"][string] }) {
  const tokens = metaNumber(runtime.meta, "tokens", 0);
  const bucket = metaNumber(runtime.meta, "bucket", 1);
  const fill = bucket > 0 ? Math.max(0, Math.min(1, tokens / bucket)) : 0;

  return (
    <g aria-hidden>
      <rect
        x={GAUGE_X}
        y={GAUGE_Y}
        width={GAUGE_W}
        height={GAUGE_H}
        rx={3.5}
        fill="var(--color-border)"
      />
      <rect
        x={GAUGE_X}
        y={GAUGE_Y}
        width={GAUGE_W}
        height={GAUGE_H}
        rx={3.5}
        fill="var(--color-accent)"
        style={{
          transformBox: "fill-box",
          transformOrigin: "bottom",
          transform: `scaleY(${fill})`,
          transition: "transform 150ms linear",
        }}
      />
    </g>
  );
}

export function RateLimitingFigure() {
  return (
    <SectionFigure
      sim={rateLimitingSim}
      nodeOverlay={(spec, runtime) =>
        spec.id === "limiter" ? <TokenGauge runtime={runtime} /> : null
      }
      // "burst" has no figure — pressing the burst button is its whole point.
      completes={[{ on: "button-press", id: "burst", section: "burst" }]}
      description="A token-bucket rate limiter between clients and api-1. The gauge inside the limiter is the bucket: tokens refill at a slider-set rate, each forwarded request spends one, and requests arriving to an empty bucket bounce back red as 429s. Everything admitted queues at api-1, which serves 8 req/s and can be clicked dead — while it is down the limiter keeps spending tokens and the forwarded requests bounce as drops. A burst of 30 requests fires on the timeline and can be replayed with the burst button."
    />
  );
}
