"use client";

import { SectionFigure } from "@/components/lesson/SectionFigure";
import type { SimSnapshot } from "@/engine/snapshot";
import { DEFAULT_EXP, fanoutSim } from "./fanout";

/* ---------------------------------------------------------------------------
   Two plates, both of which exist for the same reason: the numbers this lesson
   is about (a five-million-follower audience, a five-million-write backlog)
   cannot be drawn as packets — the pool is 128 — and they don't fit the node's
   built-in queue-depth chip either, which is sized for two digits. So the
   storm is printed, compactly, right where it happens.

   Geometry is the fixed 800x450 stage viewBox. Both plates sit in the empty
   band above the top row of nodes (poster and fanout-q boxes start at y=65),
   clear of the figure's own "fig · fanout · seed 42" plate on the right.
--------------------------------------------------------------------------- */

const SUPERSCRIPT = "⁰¹²³⁴⁵⁶⁷⁸⁹";

/** 5,000,000 → "5.0M". Four characters beat eight digits at 9px. */
function compact(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}K`;
  return String(Math.round(n));
}

/** Sim-seconds of backlog → the sentence a follower would say. */
function behind(seconds: number): string {
  if (seconds >= 3600) return `${(seconds / 3600).toFixed(1)} HOURS BEHIND`;
  if (seconds >= 90) return `${Math.round(seconds / 60)} MIN BEHIND`;
  return `${seconds.toFixed(1)}S BEHIND`;
}

/** The audience slider is an exponent; say so when the count is a decade. */
function decadeLabel(followers: number): string {
  const exp = Math.log10(followers);
  if (!Number.isInteger(exp) || exp < 0 || exp > 9) return "";
  return `10${SUPERSCRIPT[exp]} · `;
}

const MONO = { font: "600 9px var(--font-plex-mono)", letterSpacing: "0.1em" };

function FanoutOverlay(snapshot: SimSnapshot) {
  // The first (server) snapshot has no metrics yet — fall back to the slider's
  // default so the plate never flashes "0 FOLLOWERS".
  const followers = snapshot.metrics.followers || 10 ** DEFAULT_EXP;
  const backlog = snapshot.metrics.backlog ?? 0;
  const staleness = snapshot.metrics.staleness ?? 0;
  const storm = backlog >= 1;
  // Warning hue for a backlog measured in minutes — never the brand amber.
  const stormColor =
    staleness > 60 ? "var(--color-glow-orange)" : "var(--color-accent)";

  return (
    <g aria-hidden>
      {/* Audience: what the next POST will cost, in one place. */}
      <rect
        x={38}
        y={26}
        width={132}
        height={22}
        rx={5}
        fill="var(--color-surface)"
        stroke="var(--color-border)"
        strokeWidth={1}
      />
      <text x={46} y={41} fill="var(--color-fg-muted)" style={MONO}>
        AUDIENCE ·{" "}
        <tspan fill="var(--color-accent)">
          {`${decadeLabel(followers)}${compact(followers)}`}
        </tspan>
      </text>

      {/* The storm, as an aggregate: a count and a wait, not five million dots. */}
      {storm && (
        <g>
          <rect
            x={418}
            y={16}
            width={146}
            height={38}
            rx={5}
            fill="var(--color-surface)"
            stroke={stormColor}
            strokeWidth={1}
            opacity={0.95}
          />
          <text x={426} y={31} fill="var(--color-fg-muted)" style={MONO}>
            BACKLOG ·{" "}
            <tspan fill={stormColor}>{compact(backlog)}</tspan> WRITES
          </text>
          <text x={426} y={46} fill={stormColor} style={MONO}>
            {behind(staleness)}
          </text>
        </g>
      )}
    </g>
  );
}

export function FanoutFigure() {
  return (
    <SectionFigure
      sim={fanoutSim}
      stageOverlay={FanoutOverlay}
      // "hybrid" has no figure of its own: choosing the fan-out mode IS that
      // section, and the checkpoint is the moment the celebrity's arithmetic
      // becomes the learner's own.
      completes={[
        { on: "param-change", id: "mode", section: "hybrid" },
        { on: "quiz-answered", id: "fo-write-cost", section: "hybrid" },
      ]}
      description="A poster, an api, a fan-out queue and a three-node follower-timeline fleet on the write path; readers and a posts store on the read path. The write storm is shown as aggregates, never as packets: a post is a single dot carrying its cost as a number, the fan-out is one batch dot that lands on the queue as a count, and the backlog is printed above the queue with the resulting staleness (backlog divided by the fleet's 2,000 writes per second). Meters report writes per post, backlog, staleness, reads per feed load and read operations per second. In push mode a post costs one write per follower; in pull mode it costs one write but every feed load merges 200 author feeds; hybrid pays one write and a handful of extra reads."
    />
  );
}
