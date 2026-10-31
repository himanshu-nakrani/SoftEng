"use client";

import type { ParseChip, ParserState } from "./parser";

const VIEW_W = 800;
const PAD_X = 16;
const ROW_H = 28;
const GAP = 8;
const CH = 6.7;
const CHIP_PAD = 18;

export function ParserView({ state }: { state: ParserState }) {
  const w = Math.max(
    ...state.tokens.map((t) => t.text.length),
    ...state.nodes.map((n) => n.text.length),
    4,
  ) * CH + CHIP_PAD;
  const inner = VIEW_W - PAD_X * 2;
  const per = Math.max(1, Math.floor((inner + GAP) / (w + GAP)));
  let y = 44;
  const tokY = y;
  y += ROW_H + 16;
  const nodeY = y;
  y += Math.max(1, Math.ceil(Math.max(state.nodes.length, 1) / per)) * (ROW_H + GAP) + 8;

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${y}`}
      className="block h-auto w-full"
      role="img"
      aria-label={`parser ${state.kind}, ${state.stamp}`}
    >
      <text x={PAD_X} y={16} fill="var(--color-fg-faint)" style={STAMP}>
        {state.kind === "prec" ? "PRECEDENCE" : "FLAT"}
      </text>
      <text x={PAD_X} y={30} fill="var(--color-fg-faint)" style={STAMP}>
        {state.stamp}
        {state.value !== null ? ` · ${state.source}` : ""}
      </text>
      <text x={PAD_X} y={tokY - 4} fill="var(--color-fg-faint)" style={TINY}>
        TOKENS
      </text>
      {state.tokens.map((t, i) => (
        <Chip key={`t${i}`} c={t} x={PAD_X + (i % per) * (w + GAP)} y={tokY + Math.floor(i / per) * (ROW_H + GAP)} w={w} />
      ))}
      <text x={PAD_X} y={nodeY - 4} fill="var(--color-fg-faint)" style={TINY}>
        REDUCTIONS
      </text>
      {state.nodes.map((n, i) => (
        <Chip key={`n${i}`} c={n} x={PAD_X + (i % per) * (w + GAP)} y={nodeY + Math.floor(i / per) * (ROW_H + GAP)} w={w} />
      ))}
    </svg>
  );
}

function Chip({ c, x, y, w }: { c: ParseChip; x: number; y: number; w: number }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect
        width={w}
        height={ROW_H}
        rx={2}
        fill={c.active ? "transparent" : "var(--color-raised)"}
        stroke={c.active ? "var(--color-accent)" : "var(--color-border)"}
        strokeDasharray={c.active ? "3 2" : undefined}
      />
      <text x={8} y={18} fill={c.active ? "var(--color-accent)" : "var(--color-fg-muted)"} style={BODY}>
        {c.text}
      </text>
    </g>
  );
}

const STAMP = { font: "500 10px var(--font-plex-mono)", letterSpacing: "0.14em" } as const;
const TINY = { font: "500 9px var(--font-plex-mono)", letterSpacing: "0.12em" } as const;
const BODY = { font: "500 11px var(--font-plex-mono)" } as const;
