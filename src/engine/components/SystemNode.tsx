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
import { useState, type ReactNode } from "react";
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

/**
 * How far the invisible tap target reaches past the 88x60 box. The stage is
 * scaled down hard on phones (an 800-wide viewBox inside a ~360px column), so
 * a node's real-world target is closer to 40x27px — under every touch-target
 * guideline. Padding the hit area in *stage* units scales with the stage.
 */
const HIT_PAD = 8;

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
  /** Shared workbench emphasis for a component participating in the active causal event. */
  focused?: boolean;
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
  focused = false,
}: SystemNodeProps) {
  const Icon = kindIcon[spec.kind];
  const dead = runtime.health === "dead";
  const degraded = runtime.health === "degraded";
  const breakable = Boolean(spec.breakable && onToggleHealth && !runtime.ghost);
  // SVG :focus-visible support is uneven across engines (and the group is a
  // <g>, not a control), so the focus rect is driven by explicit focus state.
  const [keyboardFocused, setKeyboardFocused] = useState(false);

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
      // The UA outline is replaced, not removed: the focus rect below draws on
      // every focus (a superset of :focus-visible) and hugs the node box, which
      // the outline around the padded hit area would not.
      style={breakable ? { cursor: "pointer", outline: "none" } : undefined}
      onClick={breakable ? () => onToggleHealth?.(spec.id) : undefined}
      role={breakable ? "button" : undefined}
      tabIndex={breakable ? 0 : undefined}
      onFocus={breakable ? () => setKeyboardFocused(true) : undefined}
      onBlur={breakable ? () => setKeyboardFocused(false) : undefined}
      onKeyDown={
        breakable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                // The figure binds Space to play/pause; a focused node owns it.
                e.stopPropagation();
                onToggleHealth?.(spec.id);
              }
            }
          : undefined
      }
      aria-label={`${spec.label}, ${spec.kind}, status: ${runtime.health}${focused ? ". Part of the active causal event." : ""}${breakable ? ". Press to toggle failure." : ""}`}
    >
      {/* Touch target, painted first so it never sits over the node's own
          chrome. Invisible, but `pointer-events: all` hit-tests anyway. */}
      {breakable && (
        <rect
          x={-HIT_PAD}
          y={-HIT_PAD}
          width={W + HIT_PAD * 2}
          height={H + HIT_PAD * 2}
          rx={10 + HIT_PAD}
          fill="none"
          pointerEvents="all"
        />
      )}

      {focused && (
        <rect
          x={-5}
          y={-5}
          width={W + 10}
          height={H + 10}
          rx={14}
          fill="var(--color-accent-dim)"
          stroke="var(--color-accent)"
          strokeWidth={1.5}
          strokeDasharray="4 3"
          pointerEvents="none"
        />
      )}
      <motion.rect
        width={W}
        height={H}
        rx={10}
        fill="var(--color-surface)"
        stroke={focused ? "var(--color-accent)" : stroke}
        strokeWidth={focused ? 1.75 : dead ? 1.5 : 1}
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
          top-left   breakable badge (breakable nodes only)
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

      {/* Breakable badge — mirrors the dead badge across the node's top edge
          (top-left vs top-right), so "can be killed" and "is killed" read as
          one pair. Cursor + hover-stroke were the only signal before, and
          touch has neither. The pulse is decoration; the badge is the
          information, so reduced motion keeps the badge and drops the pulse
          (see `.break-pulse` in globals.css). */}
      {breakable && !dead && (
        <g
          /* mirrors the dead badge's `translate(W - 10, 2)` */
          transform="translate(10 2)"
          className="break-pulse"
          pointerEvents="none"
          aria-hidden
        >
          <circle
            r={7}
            fill="var(--color-surface)"
            stroke="var(--color-glow-red)"
            strokeWidth={1}
          />
          <Zap
            x={-4.5}
            y={-4.5}
            width={9}
            height={9}
            strokeWidth={2.5}
            color="var(--color-glow-red)"
          />
        </g>
      )}

      {/* Explicit keyboard focus rect (see the outline reset above). */}
      {breakable && keyboardFocused && (
        <rect
          x={-4}
          y={-4}
          width={W + 8}
          height={H + 8}
          rx={12}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth={1.5}
          pointerEvents="none"
        />
      )}

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
