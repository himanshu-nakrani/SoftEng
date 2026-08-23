"use client";

import { SectionFigure } from "@/components/lesson/SectionFigure";
import type { SimSnapshot } from "@/engine/snapshot";
import type { NodeSpec } from "@/engine/types";
import type { ReactNode } from "react";
import { cdnEdgeSim } from "./cdn-edge";

/** SystemNode's box, in its own local coordinate space. */
const NODE_W = 88;
const NODE_H = 60;

type NodeRuntimeView = SimSnapshot["nodes"][string];

/** Past this, someone in that region is talking to the origin on every hit. */
const SLOW_MS = 250;

function pill(
  y: number,
  text: string,
  color: string,
  fill?: { frac: number; color: string },
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
        stroke="var(--color-border-bright)"
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
      {fill && (
        <>
          <rect
            x={-w / 2 + 5}
            y={4.4}
            width={w - 10}
            height={1.6}
            rx={0.8}
            fill="var(--color-border)"
          />
          <rect
            x={-w / 2 + 5}
            y={4.4}
            width={Math.max((w - 10) * fill.frac, 0)}
            height={1.6}
            rx={0.8}
            fill={fill.color}
            style={{ transition: "width 150ms linear" }}
          />
        </>
      )}
    </g>
  );
}

/**
 * The two numbers this lesson is argued with, hung on the nodes that own them.
 *
 * Under each client: what that region's users are actually waiting, in ms —
 * so "pop-sin died" reads as one chip tripling while its neighbours sit still,
 * which no single shared meter can show.
 *
 * Above each PoP: how long its freshest copy has left to live, with a drain
 * bar. Once the origin is gone those three bars are the entire outage — you
 * watch the loan run out, and the region turns amber the moment it does.
 */
function edgeBadge(spec: NodeSpec, runtime: NodeRuntimeView): ReactNode {
  const meta = runtime.meta;
  if (!meta || runtime.health === "dead") return null;

  if (spec.kind === "client" && typeof meta.latencyMs === "number") {
    const ms = Math.round(meta.latencyMs);
    return pill(
      NODE_H + 14,
      `${ms} ms`,
      ms > SLOW_MS ? "var(--color-glow-orange)" : "var(--color-accent)",
    );
  }

  if (spec.kind === "cache" && typeof meta.freshFor === "number") {
    const freshFor = meta.freshFor;
    const frac = typeof meta.freshFrac === "number" ? meta.freshFrac : 0;
    if (freshFor <= 0) {
      return pill(-14, "stale", "var(--color-glow-orange)");
    }
    return pill(-14, `ttl ${freshFor.toFixed(1)}s`, "var(--color-accent)", {
      frac,
      color: "var(--color-accent)",
    });
  }

  return null;
}

export function CdnEdgeFigure() {
  return (
    <SectionFigure
      sim={cdnEdgeSim}
      nodeOverlay={edgeBadge}
      // "origin-down" has no figure of its own: killing the origin here — or
      // answering the checkpoint that follows it — is what demonstrates it.
      completes={[
        { on: "node-kill", id: "origin", section: "origin-down" },
        { on: "quiz-answered", id: "cdn-origin-down", section: "origin-down" },
      ]}
      description="A map of three regions — us-west, eu and apac — each one short hop from its own edge PoP (pop-sfo, pop-fra, pop-sin), with a single origin server far to the right. Amber requests reach a PoP in a fraction of a second; a fresh copy comes straight back green, while a lapsed one sends a cyan fetch down the long slow link to the origin first. Violet packets are requests that skip the edge entirely — dynamic content, or a region whose PoP has died and must talk to the origin itself, which triples that region's latency while the other two are unaffected. The chip under each client is its current latency in milliseconds; the pill above each PoP counts down how long its freshest cached copy has left. Sliders set the edge TTL, static or dynamic content, and per-region traffic; meters show edge hit ratio, origin requests per second, the slowest region and cumulative errors. Selecting the origin kills it: nothing changes at first, because every PoP is still serving copies from cache — then, region by region, the TTLs lapse, the refills find nobody home, and red errors begin."
    />
  );
}
