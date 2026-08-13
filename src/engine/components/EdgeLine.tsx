"use client";

import type { EdgePath } from "../paths";
import type { EdgeActivity } from "../snapshot";
import type { PacketStyle } from "../types";
import { FALLBACK_PACKET_STYLE, resolvePacketStyles } from "./PacketLayer";

interface EdgeLineProps {
  path: EdgePath;
  /** Dim the edge (e.g. its target node is dead). */
  dimmed?: boolean;
  /**
   * In-flight traffic on this edge — `snapshot.edgeActivity[edge.id]`. Read
   * only in reduced-motion mode; the packet layer is the signal otherwise.
   */
  activity?: EdgeActivity;
  /**
   * Reduced-motion mode: `PacketLayer` is hidden, so the edge itself carries
   * the traffic as weight + color instead of moving dots.
   */
  reducedMotion?: boolean;
  /** Resolved style map (see `resolvePacketStyles`); defaults to the built-ins. */
  packetStyles?: Record<string, PacketStyle>;
  /** Shared workbench emphasis for a path participating in the active causal event. */
  focused?: boolean;
}

/** Packets on one edge that count as "as busy as it gets" — heat saturates here. */
const HEAT_SATURATION = 6;

const IDLE_WIDTH = 1.25;
const BUSY_WIDTH = 3.5;
const IDLE_OPACITY = 0.7;
const BUSY_OPACITY = 1;

/**
 * A connection between nodes: hairline Bézier the packets travel along.
 *
 * Under reduced motion it doubles as the traffic display. Hiding the packet
 * layer removes the product's core information, not just its animation — so
 * the edge takes that information back on in properties that don't move:
 * stroke weight and opacity ramp with the number of packets in flight, and the
 * stroke takes the color of whatever type dominates the edge (the same token
 * those packets would have been drawn in). CSS transitions smooth the 10Hz
 * snapshot steps; nothing translates.
 *
 * With no traffic — including the very first render, before any tick — the
 * output is identical to normal-motion mode. That is deliberate: it keeps the
 * hydration markup independent of a media query the server never saw.
 */
export function EdgeLine({
  path,
  dimmed,
  activity,
  reducedMotion,
  packetStyles,
  focused = false,
}: EdgeLineProps) {
  const count = reducedMotion ? (activity?.count ?? 0) : 0;

  if (count === 0) {
    return (
      <path
        d={path.d}
        fill="none"
        stroke={focused ? "var(--color-accent)" : "var(--color-border-bright)"}
        strokeWidth={focused ? IDLE_WIDTH + 1.35 : IDLE_WIDTH}
        strokeOpacity={dimmed ? 0.25 : focused ? 1 : IDLE_OPACITY}
        style={{ transition: "stroke-opacity 300ms, stroke-width 220ms, stroke 220ms" }}
      />
    );
  }

  const heat = Math.min(count, HEAT_SATURATION) / HEAT_SATURATION;
  const styles = packetStyles ?? resolvePacketStyles();
  const dominant = activity?.dominantType;
  const stroke =
    (dominant ? styles[dominant] : undefined)?.color ??
    FALLBACK_PACKET_STYLE.color;

  return (
    <path
      d={path.d}
      fill="none"
      stroke={focused ? "var(--color-accent)" : stroke}
      strokeWidth={IDLE_WIDTH + (BUSY_WIDTH - IDLE_WIDTH) * heat + (focused ? 1 : 0)}
      strokeLinecap="round"
      strokeOpacity={
        dimmed ? 0.25 : focused ? 1 : IDLE_OPACITY + (BUSY_OPACITY - IDLE_OPACITY) * heat
      }
      style={{
        // Snapshots land every ~100ms; a transition just longer than that
        // reads as a level changing, never as something traveling.
        transition: "stroke-opacity 250ms, stroke-width 250ms, stroke 250ms",
      }}
    />
  );
}
