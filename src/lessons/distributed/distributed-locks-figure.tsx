"use client";

import { SectionFigure } from "@/components/lesson/SectionFigure";
import type { SimSnapshot } from "@/engine/snapshot";
import type { NodeSpec } from "@/engine/types";
import type { ReactNode } from "react";
import { distributedLocksSim } from "./distributed-locks";

type NodeRuntimeView = SimSnapshot["nodes"][string];

/** SystemNode's box width — badges center on it. */
const NODE_W = 88;

function metaNumber(meta: Record<string, unknown> | undefined, key: string): number {
  const v = meta?.[key];
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

/**
 * The token badge over the store: the highest token it has accepted — its
 * fence. Any write carrying a lower token is refused. When two workers believe
 * they hold the lock the badge turns to warn that the fence is now the only
 * thing standing between order and a second writer.
 */
function StoreBadge(_spec: NodeSpec, runtime: NodeRuntimeView): ReactNode {
  const token = metaNumber(runtime.meta, "token");
  const writers = metaNumber(runtime.meta, "writers");
  const split = writers >= 2;
  const color = split ? "var(--color-glow-orange)" : "var(--color-fg-muted)";
  const text = `fence ≥ ${token}`;
  const w = text.length * 5.4 + 14;

  return (
    <g transform={`translate(${NODE_W / 2} -13)`} aria-hidden>
      <rect
        x={-w / 2}
        y={-7}
        width={w}
        height={14}
        rx={7}
        fill="var(--color-raised)"
        stroke={color}
        strokeWidth={split ? 1 : 0.75}
        style={{ transition: "stroke 300ms" }}
      />
      <text
        y={3.5}
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
 * The token badge over each worker: the token IT believes its lease carries.
 * The whole failure is legible the moment two of these are lit at once and
 * they disagree — the paused worker still showing the old number, the live one
 * showing the new. A worker with no lease shows nothing.
 */
function workerBadge(runtime: NodeRuntimeView, token: number, lit: boolean): ReactNode {
  if (!lit) return null;
  const dead = runtime.health === "dead";
  const color = dead ? "var(--color-fg-faint)" : "var(--color-accent)";
  const text = `token ${token}`;
  const w = text.length * 5.4 + 14;

  return (
    <g transform={`translate(${NODE_W / 2} -13)`} aria-hidden>
      <rect
        x={-w / 2}
        y={-7}
        width={w}
        height={14}
        rx={7}
        fill="var(--color-raised)"
        stroke={color}
        strokeWidth={0.75}
      />
      <text
        y={3.5}
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
 * A stage banner naming the split-brain: two workers believing they hold the
 * one lock. It is on screen from the moment worker-b acquires while worker-a is
 * still paused, and it is the state fencing has to survive — not prevent.
 */
function SplitBrainBanner(snapshot: SimSnapshot) {
  if ((snapshot.metrics.believers ?? 0) < 2) return null;
  return (
    <g aria-hidden>
      <rect
        x={300}
        y={28}
        width={210}
        height={20}
        rx={4}
        fill="var(--color-bg)"
        stroke="var(--color-glow-orange)"
        strokeWidth={1}
      />
      <text
        x={405}
        y={42}
        textAnchor="middle"
        fill="var(--color-glow-orange)"
        style={{ font: "600 9px var(--font-plex-mono)", letterSpacing: "0.06em" }}
      >
        TWO HOLDERS · ONE LOCK
      </text>
    </g>
  );
}

export function DistributedLocksFigure() {
  return (
    <SectionFigure
      sim={distributedLocksSim}
      stageOverlay={SplitBrainBanner}
      nodeOverlay={(spec: NodeSpec, runtime) => {
        if (spec.id === "store") return StoreBadge(spec, runtime);
        if (spec.id === "worker-a" || spec.id === "worker-b") {
          const token = metaNumber(runtime.meta, "token");
          // The figure reads the worker's believed token from node.meta; the
          // sim writes it there each tick (see the readouts in `step`).
          return workerBadge(runtime, token, token > 0);
        }
        return null;
      }}
      description="Two workers on the left, a lock service in the middle, and a shared store on the right. A worker that holds the lease writes to the store (green dots) and renews the lease before it expires. A badge over each worker shows the token its lease carries; a badge over the store shows the highest token it has accepted — its fence. A scripted beat pauses worker-a past its lease: the lock service's timer runs out, worker-b acquires the lock with a higher token, and worker-a wakes up still believing it holds the old one. A stage banner then reads TWO HOLDERS · ONE LOCK. With fencing off, worker-a's stale write lands (red) and the stale-writes-landed meter climbs — two workers have written to the store. With the fencing toggle on, the store rejects any write below its fence (grey) and the writes-rejected meter climbs instead. Meters show the store's token, writes accepted, stale writes landed, and writes rejected."
    />
  );
}
