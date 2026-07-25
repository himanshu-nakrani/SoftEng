"use client";

import { SectionFigure } from "@/components/lesson/SectionFigure";
import type { SimSnapshot } from "@/engine/snapshot";
import {
  consistentHashingSim,
  keyFraction,
  ownerOf,
  ownershipArcs,
  ringPoint,
  ringPositions,
  KEYSPACE,
  RING_CX,
  RING_CY,
  RING_NODE_IDS,
  RING_R,
  type RingArc,
} from "./consistent-hashing";

/**
 * One glow token per cache. Amber is the primary, so cache-1 wears it; the
 * fourth colour arrives with the fourth node, which is exactly when the
 * learner is looking for "what did the newcomer take?". Warning hues
 * (orange) and failure red are reserved — red only ever means dead here.
 */
const OWNER_COLOR: Record<string, string> = {
  n1: "var(--color-accent)",
  n2: "var(--color-glow-violet)",
  n3: "var(--color-glow-cyan)",
  n4: "var(--color-glow-green)",
};

/** Sim-seconds an arc stays lit after it changed hands. */
const FLASH_SECONDS = 1.4;

/** Radii, outward: folded dead arc · ownership band · key ticks. */
const DEAD_R = RING_R - 10;
const BAND_WIDTH = 9;
const TICK_INNER = RING_R + 9;
const TICK_OUTER = RING_R + 17;

/** SVG arc along the ring, clockwise from `from` to `to`. */
function arcPath(arc: RingArc, r: number): string {
  const a = ringPoint(arc.from, r);
  const b = ringPoint(arc.to, r);
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${r} ${r} 0 ${
    arc.span > 0.5 ? 1 : 0
  } 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
}

interface ArcBandProps {
  arcs: RingArc[];
  r: number;
  width: number;
  opacity: number;
  /** Per-arc opacity override — used for the post-remap flash. */
  opacityOf?: (arc: RingArc) => number;
  color?: (arc: RingArc) => string;
  dashed?: boolean;
  keyPrefix: string;
}

/**
 * Ownership arcs. A full-circle arc (one surviving position owns everything)
 * cannot be expressed as a single SVG arc — start and end coincide — so it is
 * drawn as a circle instead.
 */
function ArcBand({
  arcs,
  r,
  width,
  opacity,
  opacityOf,
  color,
  dashed,
  keyPrefix,
}: ArcBandProps) {
  return (
    <>
      {arcs.map((arc, i) => {
        const stroke = color?.(arc) ?? OWNER_COLOR[arc.owner];
        const o = (opacityOf?.(arc) ?? 1) * opacity;
        const shared = {
          fill: "none" as const,
          stroke,
          strokeWidth: width,
          strokeDasharray: dashed ? "5 6" : undefined,
          opacity: o,
          // State interpolation between 10Hz snapshots — never packet motion.
          style: { transition: "opacity 220ms linear" },
        };
        return arc.span >= 0.999 ? (
          <circle
            key={`${keyPrefix}-${i}`}
            cx={RING_CX}
            cy={RING_CY}
            r={r}
            {...shared}
          />
        ) : (
          <path key={`${keyPrefix}-${i}`} d={arcPath(arc, r)} {...shared} />
        );
      })}
    </>
  );
}

/**
 * The ring, live: ownership arcs coloured per owner, the 24 keys tinted with
 * whoever currently answers for them, and every ring position a node occupies.
 * All of it is derived from the sim's own hash helpers, so what you see is
 * literally what the lookups route on.
 */
function RingOverlay(snapshot: SimSnapshot) {
  const vnodes = snapshot.metrics.vnodes === 1;

  const provisioned = RING_NODE_IDS.filter(
    (id) => snapshot.nodes[id] && !snapshot.nodes[id].ghost,
  );
  const active = provisioned.filter(
    (id) => snapshot.nodes[id].health !== "dead",
  );
  const dead = provisioned.filter((id) => snapshot.nodes[id].health === "dead");

  const arcs = ownershipArcs(active, vnodes);

  // What each dead node WOULD own if it came back: drawn as a dim dashed arc
  // inside the band it collapsed into, so the fold reads as "these keys are
  // being covered by the neighbour" rather than "these keys vanished".
  const foldedArcs = dead.flatMap((id) =>
    ownershipArcs([...active, id], vnodes).filter((arc) => arc.owner === id),
  );

  // Flash the arcs that just changed hands. Sim-time driven: pausing freezes
  // the flash, and the opacity transition smooths the 10Hz steps.
  const age = snapshot.t - (snapshot.metrics.remapAt ?? -99);
  const flash = Math.max(0, Math.min(1, 1 - age / FLASH_SECONDS));
  const mask = snapshot.metrics.movedMask ?? 0;
  const gained = (arc: RingArc) => {
    const i = RING_NODE_IDS.indexOf(arc.owner as (typeof RING_NODE_IDS)[number]);
    return i >= 0 && (mask & (1 << i)) !== 0;
  };

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

      <ArcBand
        keyPrefix="band"
        arcs={arcs}
        r={RING_R}
        width={BAND_WIDTH}
        opacity={0.45}
      />

      {flash > 0 && (
        <>
          <ArcBand
            keyPrefix="flash-halo"
            arcs={arcs}
            r={RING_R}
            width={BAND_WIDTH * 2.4}
            opacity={0.22 * flash}
            opacityOf={(arc) => (gained(arc) ? 1 : 0)}
          />
          <ArcBand
            keyPrefix="flash"
            arcs={arcs}
            r={RING_R}
            width={BAND_WIDTH}
            opacity={0.55 * flash}
            opacityOf={(arc) => (gained(arc) ? 1 : 0)}
          />
        </>
      )}

      <ArcBand
        keyPrefix="folded"
        arcs={foldedArcs}
        r={DEAD_R}
        width={2.5}
        opacity={0.5}
        color={() => "var(--color-glow-red)"}
        dashed
      />

      {/* Boundaries: a notch in the band wherever one owner hands off. */}
      {arcs.map((arc, i) => {
        const inner = ringPoint(arc.to, RING_R - BAND_WIDTH / 2 - 1);
        const outer = ringPoint(arc.to, RING_R + BAND_WIDTH / 2 + 1);
        return (
          <line
            key={`cut-${i}`}
            x1={inner.x}
            y1={inner.y}
            x2={outer.x}
            y2={outer.y}
            stroke="var(--color-bg)"
            strokeWidth={2}
          />
        );
      })}

      {/* Every ring position a node occupies — three each once VNODES is on.
          Dead nodes keep dim markers where they used to answer. */}
      {provisioned.flatMap((id) => {
        const isDead = snapshot.nodes[id].health === "dead";
        return ringPositions(id, vnodes).map((at, i) => {
          const p = ringPoint(at, RING_R);
          return (
            <circle
              key={`pin-${id}-${i}`}
              cx={p.x}
              cy={p.y}
              r={3}
              fill={isDead ? "var(--color-glow-red)" : OWNER_COLOR[id]}
              stroke="var(--color-bg)"
              strokeWidth={1}
              opacity={isDead ? 0.3 : 0.9}
              style={{ transition: "opacity 300ms, fill 300ms" }}
            />
          );
        });
      })}

      {/* The 24 keys, each wearing its current owner's colour. */}
      {Array.from({ length: KEYSPACE }, (_, k) => {
        const owner = ownerOf(k, active, vnodes);
        const f = keyFraction(k);
        const inner = ringPoint(f, TICK_INNER);
        const outer = ringPoint(f, TICK_OUTER);
        return (
          <line
            key={`key-${k}`}
            x1={inner.x}
            y1={inner.y}
            x2={outer.x}
            y2={outer.y}
            stroke={
              owner ? OWNER_COLOR[owner] : "var(--color-border-bright)"
            }
            strokeWidth={2}
            opacity={owner ? 0.85 : 0.4}
            // The hand-off itself: a dead node's keys fade into the
            // successor's colour instead of jumping.
            style={{ transition: "stroke 400ms ease-out, opacity 400ms" }}
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
      stageOverlay={RingOverlay}
      description="Cache nodes placed on a hash ring. A coloured band shows each node's ownership arc and the 24 key ticks outside it are tinted with their current owner. Adding, removing or killing a node re-cuts only the neighbouring arc — the keys that moved flash briefly, and a dead node's arc is drawn dashed inside the neighbour's that absorbed it. The vnodes toggle gives every cache three ring positions, evening the arcs out."
    />
  );
}
