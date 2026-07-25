"use client";

import { SectionFigure } from "@/components/lesson/SectionFigure";
import type { SimSnapshot } from "@/engine/snapshot";
import type { NodeSpec } from "@/engine/types";
import type { ReactNode } from "react";
import {
  circuitBreakerSim,
  type BreakerNodeMeta,
  type BreakerPhase,
} from "./circuit-breaker";

/** SystemNode's box width — everything below is node-local to it. */
const NODE_W = 88;

/**
 * Chip geometry. It hangs just above the box rather than sitting in the free
 * band inside it: "HALF-OPEN" needs ~9 monospace characters, and the only
 * full-width band inside an 88x60 node is already spoken for by the label.
 * -14 clears SystemNode's own chrome (the dead-cross badge starts at y=-5).
 */
const CHIP_Y = -14;
const CHIP_H = 15;

/** Pip row: inside the node, between the label baseline (40) and the load bar (48). */
const PIP_Y = 44;
const PIP_R = 1.9;
const PIP_PITCH = 6.4;

/** Chip palette. Green = trusting, red = refusing, orange = testing. */
const PHASE_COLOR: Record<BreakerPhase, string> = {
  closed: "var(--color-glow-green)",
  open: "var(--color-glow-red)",
  "half-open": "var(--color-glow-orange)",
};

const PHASE_FILL: Record<BreakerPhase, string> = {
  closed: "var(--color-glow-green-dim)",
  open: "var(--color-glow-red-dim)",
  "half-open": "var(--color-glow-orange-dim)",
};

const PHASES: readonly BreakerPhase[] = ["closed", "open", "half-open"];

function readMeta(
  runtime: SimSnapshot["nodes"][string],
): BreakerNodeMeta | null {
  const meta = runtime.meta;
  if (!meta) return null;
  const phase = meta.phase;
  if (typeof phase !== "string") return null;
  if (!PHASES.includes(phase as BreakerPhase)) return null;
  return {
    phase: phase as BreakerPhase,
    failStreak: typeof meta.failStreak === "number" ? meta.failStreak : 0,
    threshold: typeof meta.threshold === "number" ? meta.threshold : 0,
  };
}

/**
 * The breaker's state, drawn on the breaker: the phase chip, and under it a
 * pip per failure the threshold allows. While CLOSED the pips are the live
 * consecutive-failure count and a single success wipes them — that flicker is
 * the difference between "noisy" and "down". Once the breaker has tripped they
 * are history, so they dim: the chip is what matters from then on.
 */
function breakerOverlay(
  spec: NodeSpec,
  runtime: SimSnapshot["nodes"][string],
): ReactNode {
  if (spec.id !== "breaker") return null;
  const meta = readMeta(runtime);
  if (!meta) return null;

  const text = meta.phase.toUpperCase();
  const color = PHASE_COLOR[meta.phase];
  const chipW = text.length * 5.6 + 14;
  const closed = meta.phase === "closed";

  const pips = Math.max(0, Math.min(meta.threshold, 10));
  const lit = Math.max(0, Math.min(meta.failStreak, pips));
  const rowW = (pips - 1) * PIP_PITCH;

  return (
    <g aria-hidden>
      <g transform={`translate(${NODE_W / 2} ${CHIP_Y})`}>
        <rect
          x={-chipW / 2}
          y={-CHIP_H / 2}
          width={chipW}
          height={CHIP_H}
          rx={CHIP_H / 2}
          fill={PHASE_FILL[meta.phase]}
          stroke={color}
          strokeWidth={1}
          // Interpolated between 10Hz snapshots — never per-frame motion.
          style={{ transition: "fill 250ms, stroke 250ms" }}
        />
        <text
          y={3.4}
          textAnchor="middle"
          fill={color}
          style={{
            font: "600 9px var(--font-plex-mono)",
            letterSpacing: "0.1em",
            transition: "fill 250ms",
          }}
        >
          {text}
        </text>
      </g>

      <g
        transform={`translate(${NODE_W / 2 - rowW / 2} ${PIP_Y})`}
        opacity={closed ? 1 : 0.4}
        style={{ transition: "opacity 250ms" }}
      >
        {Array.from({ length: pips }, (_, i) => (
          <circle
            key={i}
            cx={i * PIP_PITCH}
            r={PIP_R}
            fill={
              i < lit
                ? closed
                  ? "var(--color-glow-orange)"
                  : "var(--color-glow-red)"
                : "var(--color-border-bright)"
            }
            style={{ transition: "fill 180ms linear" }}
          />
        ))}
      </g>
    </g>
  );
}

export function CircuitBreakerFigure() {
  return (
    <SectionFigure
      sim={circuitBreakerSim}
      nodeOverlay={breakerOverlay}
      // The figure lives in "trip-it", which completes on its own engagement.
      // "half-open" is the section with no figure of its own: answering its
      // checkpoint — or reaching for the probe slider it is about — is what
      // demonstrates it.
      completes={[
        { on: "quiz-answered", id: "cb-half-open", section: "half-open" },
        { on: "param-change", id: "probes", section: "half-open" },
      ]}
      description="A circuit breaker between clients and svc-1. A chip above the breaker shows its state — CLOSED in green, OPEN in red, HALF-OPEN in orange — and the pips below count consecutive failures toward the trip threshold. While closed, calls cross to svc-1 and come back green; a failing call instead crawls home slowly in orange, hanging for its full timeout, and the latency sparkline climbs to 2000ms. Once the streak fills, the breaker opens: requests bounce off it as instant red refusals and latency collapses to 1ms. After the open duration it goes half-open and lets exactly one violet probe cross alone — a failed probe re-opens it for another full window, a successful one closes it and readmits the flood. svc-1 dies on the timeline at t=12 and returns still-erroring at t=17, and can be clicked dead or alive at any time. Sliders set the failure threshold, open duration, probe count and svc-1's failure rate."
    />
  );
}
