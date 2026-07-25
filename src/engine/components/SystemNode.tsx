"use client";

import type { LucideIcon } from "lucide-react";
import {
  Boxes,
  Database,
  Layers,
  Monitor,
  Network,
  Server,
  Zap,
} from "lucide-react";
import { motion } from "motion/react";
import type { ReactNode } from "react";
import type { NodeKind, NodeRuntime, NodeSpec } from "../types";

const kindIcon: Record<NodeKind, LucideIcon> = {
  client: Monitor,
  server: Server,
  loadbalancer: Network,
  database: Database,
  cache: Zap,
  queue: Layers,
  shard: Boxes,
};

const W = 88;
const H = 60;

function loadColor(load: number): string {
  if (load > 0.85) return "var(--color-glow-red)";
  if (load > 0.6) return "var(--color-glow-orange)";
  return "var(--color-glow-green)";
}

interface SystemNodeProps {
  spec: NodeSpec;
  runtime: NodeRuntime;
  /** Break-it interaction (only wired when spec.breakable). */
  onToggleHealth?: (id: string) => void;
  /**
   * Lesson-drawn node internals (cache slots, token bucket, replica log),
   * already rendered by `InteractiveFigure`'s `nodeOverlay` slot from snapshot
   * data. See the render site below for the coordinate space. Ghost
   * (unprovisioned) nodes never draw one — there is nothing inside them yet.
   */
  overlay?: ReactNode;
}

/**
 * One system component on the stage: rounded box, kind icon, monospace
 * label, live load bar, health states. Dead nodes desaturate + red-ring.
 */
export function SystemNode({
  spec,
  runtime,
  onToggleHealth,
  overlay,
}: SystemNodeProps) {
  const Icon = kindIcon[spec.kind];
  const dead = runtime.health === "dead";
  const degraded = runtime.health === "degraded";
  const breakable = Boolean(spec.breakable && onToggleHealth && !runtime.ghost);

  if (runtime.ghost) {
    return (
      <g
        transform={`translate(${spec.x - W / 2} ${spec.y - H / 2})`}
        opacity={0.35}
        aria-label={`${spec.label}, not provisioned`}
      >
        <rect
          width={W}
          height={H}
          rx={10}
          fill="none"
          stroke="var(--color-border-bright)"
          strokeWidth={1}
          strokeDasharray="4 4"
        />
        <text
          x={W / 2}
          y={H / 2 + 3}
          textAnchor="middle"
          fill="var(--color-fg-faint)"
          style={{ font: "500 10px var(--font-plex-mono)" }}
        >
          {spec.label}
        </text>
      </g>
    );
  }

  const stroke = dead
    ? "var(--color-glow-red)"
    : degraded
      ? "var(--color-glow-orange)"
      : "var(--color-border-bright)";

  return (
    <motion.g
      transform={`translate(${spec.x - W / 2} ${spec.y - H / 2})`}
      animate={{ opacity: dead ? 0.55 : 1 }}
      transition={{ duration: 0.3 }}
      style={breakable ? { cursor: "pointer" } : undefined}
      onClick={breakable ? () => onToggleHealth?.(spec.id) : undefined}
      role={breakable ? "button" : undefined}
      tabIndex={breakable ? 0 : undefined}
      onKeyDown={
        breakable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onToggleHealth?.(spec.id);
              }
            }
          : undefined
      }
      aria-label={`${spec.label}, ${spec.kind}, status: ${runtime.health}${breakable ? ". Press to toggle failure." : ""}`}
    >
      <motion.rect
        width={W}
        height={H}
        rx={10}
        fill="var(--color-surface)"
        stroke={stroke}
        strokeWidth={dead ? 1.5 : 1}
        animate={
          dead
            ? { filter: "drop-shadow(0 0 6px var(--color-glow-red))" }
            : { filter: "none" }
        }
        className={breakable && !dead ? "hover:stroke-glow-red" : undefined}
      />

      <Icon
        x={W / 2 - 9}
        y={9}
        width={18}
        height={18}
        strokeWidth={1.5}
        color={dead ? "var(--color-fg-faint)" : "var(--color-fg-muted)"}
      />

      <text
        x={W / 2}
        y={40}
        textAnchor="middle"
        fill={dead ? "var(--color-fg-faint)" : "var(--color-fg)"}
        style={{
          font: "500 10px var(--font-plex-mono)",
          letterSpacing: "0.05em",
        }}
      >
        {spec.label}
      </text>

      {/*
        Node-internals slot. Local coordinate space: (0,0) is the TOP-LEFT of
        the node box, which is 88 wide x 60 tall (W x H) — the same space the
        chrome above is drawn in. What is already occupied:
          y  9..27   kind icon (centered, 18px)
          y ~32..40  label text (baseline y=40)
          y 48..51   load bar (x 12..76)
          top-right  dead badge; bottom-right  queue-depth chip
        So the free band inside the box is roughly y 26..46 across x 6..82;
        draw outside those bounds (negative y, or y > 60) for callouts that
        hang off the node. Painted after the label and before the load bar, so
        the bar and the badges always stay legible on top.
      */}
      {overlay}

      {/* load bar */}
      <rect
        x={12}
        y={48}
        width={W - 24}
        height={3}
        rx={1.5}
        fill="var(--color-border)"
      />
      <rect
        x={12}
        y={48}
        width={Math.max((W - 24) * Math.min(runtime.load, 1), 0)}
        height={3}
        rx={1.5}
        fill={loadColor(runtime.load)}
        style={{ transition: "width 150ms linear, fill 300ms" }}
      />

      {/* dead cross badge */}
      {dead && (
        <g transform={`translate(${W - 10} 2)`}>
          <circle r={7} fill="var(--color-glow-red)" />
          <path
            d="M -2.5 -2.5 L 2.5 2.5 M 2.5 -2.5 L -2.5 2.5"
            stroke="var(--color-bg)"
            strokeWidth={1.5}
            strokeLinecap="round"
          />
        </g>
      )}

      {/* queue depth chip */}
      {runtime.queueDepth !== undefined && runtime.queueDepth > 0 && (
        <g transform={`translate(${W - 6} ${H - 6})`}>
          <rect
            x={-22}
            y={-9}
            width={26}
            height={14}
            rx={7}
            fill="var(--color-raised)"
            stroke="var(--color-border-bright)"
            strokeWidth={0.75}
          />
          <text
            x={-9}
            y={2}
            textAnchor="middle"
            fill="var(--color-glow-amber)"
            style={{ font: "600 9px var(--font-plex-mono)" }}
          >
            {runtime.queueDepth}
          </text>
        </g>
      )}
    </motion.g>
  );
}
