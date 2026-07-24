"use client";

import { SectionFigure } from "@/components/lesson/SectionFigure";
import type { SimSnapshot } from "@/engine/snapshot";
import { capTheoremSim } from "./cap-theorem";

/** Jagged red divider across the sync link while partitioned. */
function PartitionOverlay(snapshot: SimSnapshot) {
  if (!snapshot.metrics.partitioned) return null;
  // Zig-zag line crossing the rw→re edge, perpendicular-ish.
  const points = [
    [510, 60],
    [480, 130],
    [510, 200],
    [475, 270],
    [500, 340],
    [470, 410],
  ]
    .map(([x, y]) => `${x},${y}`)
    .join(" ");
  return (
    <g aria-hidden>
      <polyline
        points={points}
        fill="none"
        stroke="var(--color-glow-red)"
        strokeWidth={2}
        strokeDasharray="6 4"
        opacity={0.85}
        style={{ filter: "drop-shadow(0 0 6px var(--color-glow-red))" }}
      />
      <text
        x={452}
        y={40}
        fill="var(--color-glow-red)"
        style={{ font: "600 10px var(--font-plex-mono)", letterSpacing: "0.1em" }}
      >
        PARTITION
      </text>
    </g>
  );
}

export function CapTheoremFigure() {
  return (
    <SectionFigure
      sim={capTheoremSim}
      stageOverlay={PartitionOverlay}
      description="Two database replicas on opposite coasts, each serving local writers, connected by a replication link. A toggle severs the network between them; a mode switch chooses CP (the east side refuses writes, shown red) or AP (both sides accept and a divergence counter climbs). Healing the partition reconciles the replicas."
    />
  );
}
