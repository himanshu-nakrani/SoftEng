"use client";

import type { JitIter, JitState } from "./jit";

const VIEW_W = 800;
const PAD_X = 16;
const ROW_H = 28;
const GAP = 8;
const CH = 6.7;
const CHIP_PAD = 16;

export function JitView({ state }: { state: JitState }) {
  const w = Math.max(
    ...state.iters.map((it) => `${it.n} ${it.tier}`.length),
    6,
  ) * CH + CHIP_PAD;
  const inner = VIEW_W - PAD_X * 2;
  const per = Math.max(1, Math.floor((inner + GAP) / (w + GAP)));
  const rows = Math.max(1, Math.ceil(Math.max(state.iters.length, 1) / per));
  const y = 44 + rows * (ROW_H + GAP) + 8;

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${y}`}
      className="block h-auto w-full"
      role="img"
      aria-label={`jit, ${state.stamp}`}
    >
      <text x={PAD_X} y={16} fill="var(--color-fg-faint)" style={STAMP}>
        JIT
      </text>
      <text x={PAD_X} y={30} fill="var(--color-fg-faint)" style={STAMP}>
        {state.stamp}
      </text>
      {state.iters.map((it, i) => (
        <Iter
          key={it.n}
          it={it}
          x={PAD_X + (i % per) * (w + GAP)}
          y={44 + Math.floor(i / per) * (ROW_H + GAP)}
          w={w}
        />
      ))}
    </svg>
  );
}

function Iter({ it, x, y, w }: { it: JitIter; x: number; y: number; w: number }) {
  const stroke =
    it.tier === "deopt"
      ? "var(--color-glow-red)"
      : it.tier === "compiled"
        ? "var(--color-glow-green)"
        : it.active
          ? "var(--color-accent)"
          : "var(--color-border)";
  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect
        width={w}
        height={ROW_H}
        rx={2}
        fill={it.tier === "deopt" ? "transparent" : "var(--color-raised)"}
        stroke={stroke}
        strokeDasharray={it.tier === "deopt" ? "3 2" : undefined}
      />
      <text x={8} y={18} fill={it.active ? "var(--color-accent)" : "var(--color-fg-muted)"} style={BODY}>
        {it.n} {it.tier}
      </text>
    </g>
  );
}

const STAMP = { font: "500 10px var(--font-plex-mono)", letterSpacing: "0.14em" } as const;
const BODY = { font: "500 11px var(--font-plex-mono)" } as const;
