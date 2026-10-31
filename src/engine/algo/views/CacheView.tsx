"use client";

import type { CachePage, CacheState } from "./cache";

const VIEW_W = 800;
const PAD_X = 16;
const ROW_H = 28;
const GAP = 8;
const CH = 6.7;
const CHIP_PAD = 18;

export function CacheView({ state }: { state: CacheState }) {
  const w = Math.max(
    ...state.pages.map((p) => `${p.id} ${p.cached}`.length),
    6,
  ) * CH + CHIP_PAD;
  const at = (i: number) => PAD_X + i * (w + GAP);
  let y = 44;
  const cacheY = y;
  y += ROW_H + 16;
  const diskY = y;
  y += ROW_H + 16;

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${y}`}
      className="block h-auto w-full"
      role="img"
      aria-label={`buffer cache ${state.policy}, ${state.stamp}`}
    >
      <text x={PAD_X} y={16} fill="var(--color-fg-faint)" style={STAMP}>
        {state.policy === "writeback" ? "WRITE-BACK" : "WRITE-THROUGH"}
      </text>
      <text x={PAD_X} y={30} fill="var(--color-fg-faint)" style={STAMP}>
        {state.stamp}
      </text>
      <text x={PAD_X} y={cacheY - 4} fill="var(--color-fg-faint)" style={TINY}>
        CACHE
      </text>
      {state.pages.map((p, i) => (
        <PageChip key={`c${p.id}`} p={p} x={at(i)} y={cacheY} w={w} which="cache" />
      ))}
      <text x={PAD_X} y={diskY - 4} fill="var(--color-fg-faint)" style={TINY}>
        DISK
      </text>
      {state.pages.map((p, i) => (
        <PageChip key={`d${p.id}`} p={p} x={at(i)} y={diskY} w={w} which="disk" />
      ))}
    </svg>
  );
}

function PageChip({
  p,
  x,
  y,
  w,
  which,
}: {
  p: CachePage;
  x: number;
  y: number;
  w: number;
  which: "cache" | "disk";
}) {
  const dirty = p.dirty && which === "cache";
  const stroke = p.active
    ? "var(--color-accent)"
    : dirty
      ? "var(--color-glow-orange)"
      : "var(--color-glow-green)";
  const value = which === "cache" ? p.cached : p.disk;
  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect
        width={w}
        height={ROW_H}
        rx={2}
        fill={dirty ? "transparent" : "var(--color-raised)"}
        stroke={stroke}
        strokeDasharray={dirty ? "3 2" : undefined}
      />
      <text x={8} y={18} fill={p.active ? "var(--color-accent)" : "var(--color-fg-muted)"} style={BODY}>
        {p.id} {value}
        {dirty ? " *" : ""}
      </text>
    </g>
  );
}

const STAMP = { font: "500 10px var(--font-plex-mono)", letterSpacing: "0.14em" } as const;
const TINY = { font: "500 9px var(--font-plex-mono)", letterSpacing: "0.12em" } as const;
const BODY = { font: "500 11px var(--font-plex-mono)" } as const;
