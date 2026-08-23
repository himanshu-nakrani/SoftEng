"use client";

import { SectionFigure } from "@/components/lesson/SectionFigure";
import type { SimSnapshot } from "@/engine/snapshot";
import type { NodeSpec } from "@/engine/types";
import type { ReactNode } from "react";
import { geoReplicationSim } from "./geo-replication";

/** SystemNode's box, in its own local coordinate space. */
const NODE_W = 88;
const NODE_H = 60;

type NodeRuntimeView = SimSnapshot["nodes"][string];

/* The two region bands, in stage coordinates (800x450 viewBox). The divider
   sits at x=400 and is drawn in two segments, above and below the cables: a
   solid line across them would read as a partition, and nothing here is cut —
   that is the previous lesson. This one is about a link that works perfectly
   and is still too slow. */
const DIVIDE_X = 400;
const BAND_TOP = 26;
const BAND_H = 404;

interface Band {
  x: number;
  w: number;
  label: string;
  anchor: "start" | "end";
  labelX: number;
}

const BANDS: Band[] = [
  { x: 14, w: 372, label: "US-EAST", anchor: "start", labelX: 32 },
  { x: 414, w: 372, label: "EU-WEST", anchor: "end", labelX: 768 },
];

/**
 * The stage, told as geography: two shaded region bands with their names, and
 * the distance between them printed on the divider in the units that actually
 * matter — the round trip the slider is set to, and the length of fiber that
 * round trip is (light in glass covers ~200 km per millisecond).
 */
function RegionBands(snapshot: SimSnapshot) {
  const rtt = Math.round(snapshot.metrics.rtt ?? 80);
  // 200 km/ms of fiber, printed in thousands: 80 ms ≈ 16k km round trip.
  const km = Math.round(rtt * 0.2);
  return (
    <g aria-hidden>
      {BANDS.map((band) => (
        <g key={band.label}>
          <rect
            x={band.x}
            y={BAND_TOP}
            width={band.w}
            height={BAND_H}
            rx={8}
            fill="var(--color-surface)"
            stroke="var(--color-border)"
            strokeWidth={1}
            opacity={0.55}
          />
          <text
            x={band.labelX}
            y={BAND_TOP + 24}
            textAnchor={band.anchor}
            fill="var(--color-fg-faint)"
            style={{
              font: "600 12px var(--font-plex-mono)",
              letterSpacing: "0.18em",
            }}
          >
            {band.label}
          </text>
        </g>
      ))}

      {[
        [BAND_TOP + 38, 176],
        [322, 424],
      ].map(([y1, y2]) => (
        <line
          key={y1}
          x1={DIVIDE_X}
          y1={y1}
          x2={DIVIDE_X}
          y2={y2}
          stroke="var(--color-border-bright)"
          strokeWidth={1}
          strokeDasharray="3 6"
        />
      ))}

      <text
        x={DIVIDE_X}
        y={200}
        textAnchor="middle"
        fill="var(--color-accent)"
        style={{ font: "600 11px var(--font-plex-mono)", letterSpacing: "0.08em" }}
      >
        {rtt} ms rtt
      </text>
      <text
        x={DIVIDE_X}
        y={214}
        textAnchor="middle"
        fill="var(--color-fg-faint)"
        style={{ font: "500 9px var(--font-plex-mono)", letterSpacing: "0.06em" }}
      >
        ≈ {km}k km of fiber
      </text>
    </g>
  );
}

function pill(
  y: number,
  text: string,
  color: string,
  border = "var(--color-border-bright)",
): ReactNode {
  const w = text.length * 5.6 + 16;
  return (
    <g transform={`translate(${NODE_W / 2} ${y})`}>
      <rect
        x={-w / 2}
        y={-8}
        width={w}
        height={16}
        rx={8}
        fill="var(--color-raised)"
        stroke={border}
        strokeWidth={0.75}
      />
      <text
        y={1.5}
        textAnchor="middle"
        fill={color}
        style={{ font: "600 9px var(--font-plex-mono)", letterSpacing: "0.04em" }}
      >
        {text}
      </text>
    </g>
  );
}

/**
 * Two numbers, hung on the nodes that own them.
 *
 * Above each database: what it is allowed to do with a write — WRITER in
 * active-active (both regions are primaries, which is the whole idea), PRIMARY
 * and REPLICA once one region owns the writes. A dead region shows its
 * exposure instead: how many writes it accepted and never shipped, which is
 * exactly the number a promotion is about to destroy.
 *
 * Under each client: the latency its users are actually waiting, in ms — so
 * "single-primary" reads as one chip stepping onto the ocean while the other
 * one doesn't move.
 */
function geoBadge(spec: NodeSpec, runtime: NodeRuntimeView): ReactNode {
  const meta = runtime.meta;
  if (!meta) return null;

  if (spec.kind === "client") {
    if (runtime.health === "dead") return null;
    const ms = typeof meta.latencyMs === "number" ? Math.round(meta.latencyMs) : 0;
    return pill(
      NODE_H + 14,
      `${ms} ms`,
      ms > 60 ? "var(--color-glow-orange)" : "var(--color-accent)",
    );
  }

  const unshipped = typeof meta.unshipped === "number" ? meta.unshipped : 0;
  if (runtime.health === "dead") {
    return unshipped > 0
      ? pill(
          -14,
          `${unshipped} unshipped`,
          "var(--color-glow-red)",
          "var(--color-glow-red)",
        )
      : null;
  }

  const role = meta.role === "replica" ? "REPLICA" : meta.role === "primary" ? "PRIMARY" : "WRITER";
  return pill(
    -14,
    role,
    role === "REPLICA" ? "var(--color-fg-faint)" : "var(--color-accent)",
  );
}

export function GeoReplicationFigure() {
  return (
    <SectionFigure
      sim={geoReplicationSim}
      stageOverlay={RegionBands}
      nodeOverlay={geoBadge}
      // "conflict-or-wait" has no figure of its own: the mode select IS the
      // choice it describes, and the conflict checkpoint is the bill for it.
      completes={[
        { on: "param-change", id: "mode", section: "conflict-or-wait" },
        {
          on: "quiz-answered",
          id: "geo-conflict",
          correctOnly: false,
          section: "conflict-or-wait",
        },
      ]}
      description="Two shaded region bands — us-east on the left, eu-west on the right — each holding an application and its own database, with the round trip between them printed on the divider in milliseconds and in kilometres of fiber. Violet packets are writes: they cross the short local hop to the region's own database in about 17 ms, and replication copies then cross the ocean, taking exactly the time the inter-region RTT slider is set to. In active-active both databases accept writes, so two regions can update the same key before either has heard of the other; when the copies meet, last-write-wins keeps one, an orange dot travels back to the client whose write was discarded, and the conflicts counter climbs. In single-primary the eu-west database is only a replica, so its users' writes cross the ocean to us-east and wait for the acknowledgement to come back — no conflicts, and an eu-west latency meter pinned at the round trip. A badge over each database says whether it is a writer, a primary or a replica; a chip under each client is that region's measured latency. Part-way through, the whole us-east region dies: in active-active eu-west keeps serving its own users unaffected, while in single-primary eu-west's writes cross the ocean and come back red until eu-west is promoted, at which point every write us-east accepted but never replicated is counted as lost."
    />
  );
}
