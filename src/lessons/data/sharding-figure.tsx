"use client";

import { SectionFigure } from "@/components/lesson/SectionFigure";
import type { SimSnapshot } from "@/engine/snapshot";
import {
  KEYSPACE,
  SHARD_IDS,
  shardIndexForKey,
  shardingSim,
} from "./sharding";

/* ---------------------------------------------------------------------------
   The keyspace strip: one slot per key, colored by the shard that owns it.
   Resharding is invisible in the packet flow (the dots look the same either
   way) — it is only visible here, where 3 → 4 repaints almost every slot.

   Geometry is in the fixed 800x450 stage viewBox. The strip lives in the empty
   lower-left band: clear of the shard column (node boxes start at x=601), clear
   of the router→shard-3 bow (still above y=313 where the strip plate ends), and
   above the caption plate that hugs the bottom edge of the stage.
--------------------------------------------------------------------------- */

const STRIP_X = 44;
const STRIP_W = 452;
const STRIP_Y = 330;
const STRIP_H = 20;
const SLOT_PITCH = STRIP_W / KEYSPACE;
const SLOT_W = SLOT_PITCH - 2;

/** One hue per shard index, straight from the theme tokens. */
const SHARD_HUE = [
  "var(--color-glow-violet)",
  "var(--color-glow-cyan)",
  "var(--color-glow-green)",
  "var(--color-accent)",
] as const;

/** Shard node centers, read off the topology so the chips can't drift. */
const SHARD_CENTER = new Map(
  shardingSim.topology.nodes.map((node) => [node.id, node] as const),
);

/** The slider's default — what the strip shows before the first tick lands. */
const DEFAULT_SHARDS = 3;

/**
 * Snapshot-only overlay: the shard count the sim last routed with, plus who is
 * dead. Slot owners come from `shardIndexForKey`, the same pure function the
 * router calls, so the strip is the routing rule rather than a copy of it.
 */
function KeyspaceStrip(snapshot: SimSnapshot) {
  const reported = Math.round(snapshot.metrics.shards ?? 0);
  const n = reported >= 1 ? Math.min(reported, SHARD_IDS.length) : DEFAULT_SHARDS;
  const dead = SHARD_IDS.map((id) => snapshot.nodes[id]?.health === "dead");

  return (
    <g aria-hidden>
      <text
        x={STRIP_X}
        y={STRIP_Y - 10}
        fill="var(--color-fg-faint)"
        style={{
          font: "500 9px var(--font-plex-mono)",
          letterSpacing: "0.12em",
        }}
      >
        {`KEYSPACE · ${KEYSPACE} KEYS · HASH(KEY) % ${n}`}
      </text>

      <rect
        x={STRIP_X - 5}
        y={STRIP_Y - 5}
        width={STRIP_W + 10}
        height={STRIP_H + 10}
        rx={5}
        fill="var(--color-surface)"
        stroke="var(--color-border)"
        strokeWidth={1}
      />

      {Array.from({ length: KEYSPACE }, (_, key) => {
        const owner = shardIndexForKey(key, n);
        const dark = dead[owner];
        return (
          <rect
            key={key}
            x={STRIP_X + key * SLOT_PITCH}
            y={STRIP_Y}
            width={SLOT_W}
            height={STRIP_H}
            rx={1.5}
            fill={dark ? "var(--color-glow-red-dim)" : SHARD_HUE[owner]}
            stroke={dark ? "var(--color-glow-red)" : "none"}
            strokeWidth={dark ? 1 : 0}
            opacity={dark ? 1 : 0.8}
            style={{ transition: "fill 260ms ease, opacity 260ms ease" }}
          />
        );
      })}

      {/* Hue chip beside each provisioned shard — the strip's legend. */}
      {SHARD_IDS.map((id, i) => {
        const center = SHARD_CENTER.get(id);
        if (!center || i >= n) return null;
        return (
          <rect
            key={id}
            x={center.x + 49}
            y={center.y - 22}
            width={6}
            height={44}
            rx={3}
            fill={SHARD_HUE[i]}
            opacity={dead[i] ? 0.25 : 0.85}
            style={{ transition: "opacity 260ms ease" }}
          />
        );
      })}
    </g>
  );
}

export function ShardingFigure() {
  return (
    <SectionFigure
      sim={shardingSim}
      stageOverlay={KeyspaceStrip}
      // "reshard-pain" has no figure of its own — moving the shard slider IS
      // the pain, and killing a shard is the same coupling seen from the other
      // side (one owner per key, so one death darkens a whole slice).
      completes={[
        { on: "param-change", id: "shards", section: "reshard-pain" },
        { on: "node-kill", section: "reshard-pain" },
      ]}
      description="A router distributing keyed queries across shards using hash(key) mod N. A strip along the bottom shows all 48 keys, each colored by its owning shard: changing the shard slider recolors nearly every key, and killing a shard turns its keys red — those queries bounce back as errors, because hash mod N has no reroute."
    />
  );
}
