"use client";

import type { VtableSlot, VtableState } from "./vtable";

const VIEW_W = 800;
const PAD_X = 16;
const ROW_H = 28;
const GAP = 8;
const CH = 6.7;
const CHIP_PAD = 18;
const OBJ_W = 120;

export function VtableView({ state }: { state: VtableState }) {
  const w = Math.max(
    ...state.table.map((s) => `${s.name} ${s.fn}`.length),
    8,
  ) * CH + CHIP_PAD;
  const inner = VIEW_W - PAD_X * 2 - OBJ_W - GAP;
  const per = Math.max(1, Math.floor((inner + GAP) / (w + GAP)));
  const rows = Math.max(1, Math.ceil(Math.max(state.table.length, 1) / per));
  const y = 44 + ROW_H + 16 + rows * (ROW_H + GAP);

  const title =
    state.kind === "static" ? "STATIC" : state.kind === "vtable" ? "VTABLE" : "ITABLE";

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${y}`}
      className="block h-auto w-full"
      role="img"
      aria-label={`${state.kind}, ${state.stamp}`}
    >
      <text x={PAD_X} y={16} fill="var(--color-fg-faint)" style={STAMP}>
        {title}
      </text>
      <text x={PAD_X} y={30} fill="var(--color-fg-faint)" style={STAMP}>
        {state.stamp}
      </text>
      {state.obj ? (
        <g transform={`translate(${PAD_X}, 44)`}>
          <rect
            width={OBJ_W}
            height={ROW_H}
            rx={2}
            fill="var(--color-raised)"
            stroke="var(--color-accent)"
          />
          <text x={8} y={18} fill="var(--color-accent)" style={BODY}>
            {state.obj} {state.cls}
          </text>
        </g>
      ) : null}
      <text x={PAD_X + OBJ_W + GAP} y={40} fill="var(--color-fg-faint)" style={TINY}>
        {state.kind === "static" ? "NO TABLE" : "TABLE"}
      </text>
      {state.table.map((s, i) => (
        <Slot
          key={`${s.name}${i}`}
          s={s}
          x={PAD_X + OBJ_W + GAP + (i % per) * (w + GAP)}
          y={44 + Math.floor(i / per) * (ROW_H + GAP)}
          w={w}
        />
      ))}
    </svg>
  );
}

function Slot({ s, x, y, w }: { s: VtableSlot; x: number; y: number; w: number }) {
  const stroke = s.active
    ? "var(--color-accent)"
    : s.matched
      ? "var(--color-glow-green)"
      : "var(--color-border)";
  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect
        width={w}
        height={ROW_H}
        rx={2}
        fill={s.matched || s.active ? "transparent" : "var(--color-raised)"}
        stroke={stroke}
        strokeDasharray={s.active && !s.matched ? "3 2" : undefined}
      />
      <text x={8} y={18} fill={s.active ? "var(--color-accent)" : "var(--color-fg-muted)"} style={BODY}>
        {s.name} {s.fn}
      </text>
    </g>
  );
}

const STAMP = { font: "500 10px var(--font-plex-mono)", letterSpacing: "0.14em" } as const;
const TINY = { font: "500 9px var(--font-plex-mono)", letterSpacing: "0.12em" } as const;
const BODY = { font: "500 11px var(--font-plex-mono)" } as const;
