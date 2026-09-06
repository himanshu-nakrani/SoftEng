"use client";

import type { BitChip, CryptoState } from "./crypto";

const VIEW_W = 800;
const PAD_X = 16;
const ROW_H = 28;
const GAP = 6;
const BIT_W = 28;

export function CryptoView({ state }: { state: CryptoState }) {
  let y = 44;
  const rowY: number[] = [];
  for (let i = 0; i < state.rows.length; i++) {
    rowY.push(y);
    y += ROW_H + 12;
  }
  y += 8;

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${Math.max(y, 80)}`}
      className="block h-auto w-full"
      role="img"
      aria-label={`crypto ${state.kind}, ${state.stamp}`}
    >
      <text x={PAD_X} y={16} fill="var(--color-fg-faint)" style={STAMP}>
        {state.kind === "hash" ? "HASH" : state.kind === "dh" ? "DIFFIE-HELLMAN" : "SIGNATURE"}
      </text>
      <text x={PAD_X} y={30} fill="var(--color-fg-faint)" style={STAMP}>
        {state.stamp}
        {state.ok === false ? " · reject" : state.ok === true ? " · accept" : ""}
      </text>
      {state.rows.map((row, ri) => (
        <g key={row.name}>
          <text x={PAD_X} y={rowY[ri]! + 18} fill="var(--color-fg-faint)" style={TINY}>
            {row.name}
          </text>
          {row.bits.map((b, i) => (
            <Bit key={`${row.name}${i}`} b={b} x={PAD_X + 48 + i * (BIT_W + GAP)} y={rowY[ri]!} />
          ))}
        </g>
      ))}
    </svg>
  );
}

function Bit({ b, x, y }: { b: BitChip; x: number; y: number }) {
  const stroke = b.active
    ? "var(--color-accent)"
    : b.flipped
      ? "var(--color-glow-orange)"
      : "var(--color-border)";
  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect
        width={BIT_W}
        height={ROW_H}
        rx={2}
        fill={b.flipped ? "transparent" : "var(--color-raised)"}
        stroke={stroke}
        strokeDasharray={b.flipped ? "3 2" : undefined}
      />
      <text
        x={BIT_W / 2}
        y={18}
        textAnchor="middle"
        fill={b.active ? "var(--color-accent)" : "var(--color-fg-muted)"}
        style={BODY}
      >
        {b.value}
      </text>
    </g>
  );
}

const STAMP = { font: "500 10px var(--font-plex-mono)", letterSpacing: "0.14em" } as const;
const TINY = { font: "500 9px var(--font-plex-mono)", letterSpacing: "0.12em" } as const;
const BODY = { font: "500 11px var(--font-plex-mono)" } as const;
