"use client";

import { SectionFigure } from "@/components/lesson/SectionFigure";
import type { SimSnapshot } from "@/engine/snapshot";
import type { NodeSpec } from "@/engine/types";
import type { ReactNode } from "react";
import { dnsResolutionSim } from "./dns-resolution";

/** SystemNode's box, in its own local coordinate space. */
const NODE_W = 88;

type NodeRuntimeView = SimSnapshot["nodes"][string];

/**
 * Above the resolver: how long its freshest cached record has left to live,
 * with a drain bar. Once the authoritative server is gone this pill IS the
 * outage — you watch the lease run out, and the resolver goes stale the moment
 * it does. The number is `state.lesson.expiresAt` distilled to one meta field,
 * so the pill and the cache can never disagree.
 */
function resolverBadge(spec: NodeSpec, runtime: NodeRuntimeView): ReactNode {
  const meta = runtime.meta;
  if (!meta || runtime.health === "dead" || spec.kind !== "cache") return null;
  const freshFor = typeof meta.freshFor === "number" ? meta.freshFor : 0;
  const frac = typeof meta.freshFrac === "number" ? meta.freshFrac : 0;

  const text = freshFor <= 0 ? "cold" : `ttl ${freshFor.toFixed(1)}s`;
  const color = freshFor <= 0 ? "var(--color-glow-orange)" : "var(--color-accent)";
  const w = text.length * 5.6 + 16;
  return (
    <g transform={`translate(${NODE_W / 2} -14)`}>
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
      {freshFor > 0 && (
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
            width={Math.max((w - 10) * frac, 0)}
            height={1.6}
            rx={0.8}
            fill="var(--color-accent)"
            style={{ transition: "width 150ms linear" }}
          />
        </>
      )}
    </g>
  );
}

export function DnsResolutionFigure() {
  return (
    <SectionFigure
      sim={dnsResolutionSim}
      nodeOverlay={resolverBadge}
      // "when-it-goes-stale" has no figure of its own: killing the
      // authoritative server here, or answering the checkpoint after it, is
      // what demonstrates the timed grace period.
      completes={[
        // "ttl-and-cache" and "when-it-goes-stale" have no figure of their
        // own: dragging the TTL, killing the authoritative server, or
        // answering the checkpoint after it are what demonstrate them.
        { on: "param-change", id: "ttl", section: "ttl-and-cache" },
        { on: "node-kill", id: "auth", section: "when-it-goes-stale" },
        { on: "quiz-answered", id: "dns-auth-down", section: "when-it-goes-stale" },
      ]}
      description="A browser on the left, a recursive resolver a short hop away, and three hierarchy servers on the right: the root, the .com TLD server, and the zone's authoritative server. A cold name walks the whole hierarchy — a cyan query to root, a violet referral back, then the same to the TLD server and finally the authoritative one — before a resolved address comes back to the browser, about 700ms of stacked round trips. Once the resolver has cached the answer, a repeat lookup is a single short hop of roughly 85ms and the hierarchy never hears about it; the pill above the resolver counts down how long its freshest record has left. Sliders set the record TTL and the browser's lookup rate; meters show the cache hit ratio, the average lookup latency, queries per second reaching the authoritative server, and cumulative failed lookups. Selecting the authoritative server kills it: nothing changes at first because cached names still resolve, then name by name the TTLs lapse, the re-walks find nobody home, and red failures begin."
    />
  );
}
