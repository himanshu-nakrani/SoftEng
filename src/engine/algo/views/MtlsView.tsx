"use client";

import type { MtlsPeer, MtlsState } from "./mtls";

const VIEW_W = 800;
const PAD_X = 16;
const BOX_W = 200;
const ROW_H = 56;
const GAP = 80;

export function MtlsView({ state }: { state: MtlsState }) {
  const y = 48;
  const clientX = PAD_X;
  const serverX = PAD_X + BOX_W + GAP;
  const midX = clientX + BOX_W + GAP / 2;

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} 140`}
      className="block h-auto w-full"
      role="img"
      aria-label={`${state.trust}, ${state.stamp}`}
    >
      <text x={PAD_X} y={16} fill="var(--color-fg-faint)" style={STAMP}>
        {state.trust === "mtls" ? "MUTUAL TLS" : "PERIMETER"}
      </text>
      <text x={PAD_X} y={30} fill="var(--color-fg-faint)" style={STAMP}>
        {state.stamp}
      </text>
      <PeerBox p={state.client} x={clientX} y={y} />
      <line
        x1={clientX + BOX_W}
        y1={y + ROW_H / 2}
        x2={serverX}
        y2={y + ROW_H / 2}
        stroke={state.connected ? "var(--color-glow-green)" : "var(--color-glow-orange)"}
        strokeDasharray={state.connected ? undefined : "4 3"}
      />
      <text
        x={midX}
        y={y + ROW_H / 2 - 8}
        textAnchor="middle"
        fill={state.connected ? "var(--color-glow-green)" : "var(--color-glow-orange)"}
        style={TINY}
      >
        {state.connected ? "connected" : "closed"}
      </text>
      <PeerBox p={state.server} x={serverX} y={y} />
    </svg>
  );
}

function PeerBox({ p, x, y }: { p: MtlsPeer; x: number; y: number }) {
  const stroke = p.active
    ? "var(--color-accent)"
    : p.valid
      ? "var(--color-glow-green)"
      : p.presented
        ? "var(--color-glow-orange)"
        : "var(--color-border)";
  const cert =
    p.cert === "none" ? "no cert" : p.cert === "other-ca" ? "other-ca" : "this-ca";
  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect
        width={BOX_W}
        height={ROW_H}
        rx={2}
        fill={p.valid ? "var(--color-raised)" : "transparent"}
        stroke={stroke}
        strokeDasharray={p.valid ? undefined : "3 2"}
      />
      <text x={12} y={22} fill={p.active ? "var(--color-accent)" : "var(--color-fg-muted)"} style={BODY}>
        {p.name}
      </text>
      <text x={12} y={40} fill="var(--color-fg-faint)" style={TINY}>
        {cert}
        {p.presented ? "" : " · silent"}
      </text>
    </g>
  );
}

const STAMP = { font: "500 10px var(--font-plex-mono)", letterSpacing: "0.14em" } as const;
const TINY = { font: "500 9px var(--font-plex-mono)", letterSpacing: "0.12em" } as const;
const BODY = { font: "500 11px var(--font-plex-mono)" } as const;
