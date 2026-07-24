"use client";

import { SectionFigure } from "@/components/lesson/SectionFigure";
import {
  consistentHashingSim,
  keyFraction,
  ringPoint,
  RING_CX,
  RING_CY,
  RING_R,
} from "./consistent-hashing";

/** The ring itself + 24 key ticks, drawn under the nodes. */
function RingOverlay() {
  return (
    <g aria-hidden>
      <circle
        cx={RING_CX}
        cy={RING_CY}
        r={RING_R}
        fill="none"
        stroke="var(--color-border-bright)"
        strokeWidth={1}
        strokeDasharray="3 5"
        opacity={0.7}
      />
      {Array.from({ length: 24 }, (_, k) => {
        const inner = ringPoint(keyFraction(k), RING_R - 5);
        const outer = ringPoint(keyFraction(k), RING_R + 5);
        return (
          <line
            key={k}
            x1={inner.x}
            y1={inner.y}
            x2={outer.x}
            y2={outer.y}
            stroke="var(--color-glow-violet)"
            strokeWidth={1.5}
            opacity={0.5}
          />
        );
      })}
    </g>
  );
}

export function ConsistentHashingFigure() {
  return (
    <SectionFigure
      sim={consistentHashingSim}
      stageOverlay={() => <RingOverlay />}
      description="Cache nodes placed on a hash ring with 24 key positions marked as ticks. Lookups route to each key's clockwise owner. Adding, removing, or killing a node moves only the neighbouring arc's keys; the remapped meter proves it."
    />
  );
}
