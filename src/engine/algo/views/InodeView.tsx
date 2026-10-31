"use client";

import type { InodePtr, InodeState } from "./inode";

const VIEW_W = 800;
const PAD_X = 16;
const ROW_H = 28;
const GAP = 8;
const CH = 6.7;
const CHIP_PAD = 16;

export function InodeView({ state }: { state: InodeState }) {
  const w = Math.round(4 * CH + CHIP_PAD);
  const at = (i: number) => PAD_X + i * (w + GAP);
  let y = 44;
  const dirY = y;
  y += ROW_H + 16;
  const indY = y;
  y += ROW_H + 16;
  const dataY = y;
  y += ROW_H + 16;

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${y}`}
      className="block h-auto w-full"
      role="img"
      aria-label={`inode, ${state.size} blocks. ${state.stamp}`}
    >
      <text x={PAD_X} y={16} fill="var(--color-fg-faint)" style={STAMP}>
        INODE
      </text>
      <text x={PAD_X} y={30} fill="var(--color-fg-faint)" style={STAMP}>
        {state.stamp}
      </text>

      <text x={PAD_X} y={dirY - 4} fill="var(--color-fg-faint)" style={TINY}>
        DIRECT
      </text>
      {state.directs.map((p, i) => (
        <Chip key={p.label} p={p} x={at(i)} y={dirY} w={w} />
      ))}

      <text x={PAD_X} y={indY - 4} fill="var(--color-fg-faint)" style={TINY}>
        INDIRECT
      </text>
      {state.indirect.map((p, i) => (
        <Chip key={p.label} p={p} x={at(i)} y={indY} w={w} />
      ))}

      <text x={PAD_X} y={dataY - 4} fill="var(--color-fg-faint)" style={TINY}>
        DATA
      </text>
      {state.data.map((p, i) => (
        <Chip key={p.label} p={p} x={at(i)} y={dataY} w={w} />
      ))}
    </svg>
  );
}

function Chip({ p, x, y, w }: { p: InodePtr; x: number; y: number; w: number }) {
  const empty = p.block === null;
  const stroke = p.active
    ? "var(--color-accent)"
    : empty
      ? "var(--color-border)"
      : "var(--color-glow-green)";
  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect
        width={w}
        height={ROW_H}
        rx={2}
        fill={empty ? "transparent" : "var(--color-raised)"}
        stroke={stroke}
        strokeDasharray={empty ? "3 2" : undefined}
      />
      <text x={8} y={18} fill={p.active ? "var(--color-accent)" : "var(--color-fg-muted)"} style={BODY}>
        {empty ? p.label : `${p.label}:${p.block}`}
      </text>
    </g>
  );
}

const STAMP = { font: "500 10px var(--font-plex-mono)", letterSpacing: "0.14em" } as const;
const TINY = { font: "500 9px var(--font-plex-mono)", letterSpacing: "0.12em" } as const;
const BODY = { font: "500 11px var(--font-plex-mono)" } as const;
