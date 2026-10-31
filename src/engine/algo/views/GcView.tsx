"use client";

import type { GcObj, GcState } from "./gc";

const VIEW_W = 800;
const PAD_X = 16;
const ROW_H = 28;
const GAP = 8;
const CH = 6.7;
const CHIP_PAD = 18;

export function GcView({ state }: { state: GcState }) {
  const w = Math.max(
    ...state.heap.map((o) => label(o).length),
    6,
  ) * CH + CHIP_PAD;
  const inner = VIEW_W - PAD_X * 2;
  const per = Math.max(1, Math.floor((inner + GAP) / (w + GAP)));
  let y = 44;
  const heapY = y;
  const rows = Math.max(1, Math.ceil(Math.max(state.heap.length, 1) / per));
  y += rows * (ROW_H + GAP) + 16;

  const title =
    state.kind === "refcount"
      ? "REFCOUNT"
      : state.kind === "mark"
        ? "MARK-SWEEP"
        : state.kind === "incremental"
          ? state.stamp.startsWith("max") || state.stamp.startsWith("budget")
            ? "INCREMENTAL"
            : "STOP-THE-WORLD"
          : "GENERATIONAL";

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${y}`}
      className="block h-auto w-full"
      role="img"
      aria-label={`gc ${state.kind}, ${state.stamp}`}
    >
      <text x={PAD_X} y={16} fill="var(--color-fg-faint)" style={STAMP}>
        {title}
      </text>
      <text x={PAD_X} y={30} fill="var(--color-fg-faint)" style={STAMP}>
        {state.stamp}
        {state.roots.length ? ` · roots ${state.roots.join(" ")}` : ""}
      </text>
      {state.heap.map((o, i) => (
        <Obj
          key={o.id}
          o={o}
          x={PAD_X + (i % per) * (w + GAP)}
          y={heapY + Math.floor(i / per) * (ROW_H + GAP)}
          w={w}
        />
      ))}
    </svg>
  );
}

function label(o: GcObj): string {
  const bits = [o.id];
  if (o.rc !== undefined) bits.push(`rc${o.rc}`);
  if (o.gen) bits.push(o.gen);
  if (o.ptr) bits.push(`→${o.ptr}`);
  if (o.freed) bits.push("free");
  if (o.lost) bits.push("lost");
  return bits.join(" ");
}

function Obj({ o, x, y, w }: { o: GcObj; x: number; y: number; w: number }) {
  const stroke = o.active
    ? "var(--color-accent)"
    : o.lost
      ? "var(--color-glow-red)"
      : o.freed
        ? "var(--color-glow-orange)"
        : o.marked
          ? "var(--color-glow-green)"
          : "var(--color-border)";
  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect
        width={w}
        height={ROW_H}
        rx={2}
        fill={o.freed || o.lost ? "transparent" : "var(--color-raised)"}
        stroke={stroke}
        strokeDasharray={o.freed || o.lost ? "3 2" : undefined}
      />
      <text x={8} y={18} fill={o.active ? "var(--color-accent)" : "var(--color-fg-muted)"} style={BODY}>
        {label(o)}
      </text>
    </g>
  );
}

const STAMP = { font: "500 10px var(--font-plex-mono)", letterSpacing: "0.14em" } as const;
const BODY = { font: "500 11px var(--font-plex-mono)" } as const;
