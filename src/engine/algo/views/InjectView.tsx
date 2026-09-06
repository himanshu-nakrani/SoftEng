"use client";

import type { InjectChip, InjectState } from "./inject";

const VIEW_W = 800;
const PAD_X = 16;
const ROW_H = 28;
const GAP = 8;
const CH = 6.7;
const CHIP_PAD = 18;

export function InjectView({ state }: { state: InjectState }) {
  const w = Math.max(
    ...state.nodes.map((n) => n.text.length),
    ...state.result.map((r) => r.length),
    6,
  ) * CH + CHIP_PAD;
  const inner = VIEW_W - PAD_X * 2;
  const per = Math.max(1, Math.floor((inner + GAP) / (w + GAP)));
  const nodeRows = Math.max(1, Math.ceil(state.nodes.length / per));
  let y = 44;
  const nodeY = y;
  y += nodeRows * (ROW_H + GAP) + 16;
  const resultY = y;
  y += ROW_H + 16;

  const title =
    state.kind === "sqli" ? "SQL" : state.kind === "xss" ? "XSS" : "SSRF";

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
        {state.ok === false ? " · fail" : state.ok === true ? " · ok" : ""}
      </text>
      {state.nodes.map((n, i) => (
        <Chip
          key={`n${i}`}
          n={n}
          x={PAD_X + (i % per) * (w + GAP)}
          y={nodeY + Math.floor(i / per) * (ROW_H + GAP)}
          w={w}
        />
      ))}
      <text x={PAD_X} y={resultY - 4} fill="var(--color-fg-faint)" style={TINY}>
        {state.kind === "sqli" ? "ROWS" : state.kind === "xss" ? "DOM" : "FETCH"}
      </text>
      {state.result.length === 0 ? (
        <text x={PAD_X} y={resultY + 18} fill="var(--color-fg-muted)" style={BODY}>
          none
        </text>
      ) : (
        state.result.map((r, i) => (
          <g key={`r${i}`} transform={`translate(${PAD_X + i * (w + GAP)}, ${resultY})`}>
            <rect
              width={w}
              height={ROW_H}
              rx={2}
              fill="var(--color-raised)"
              stroke={state.ok === false ? "var(--color-glow-red)" : "var(--color-glow-green)"}
            />
            <text x={8} y={18} fill="var(--color-fg-muted)" style={BODY}>
              {r}
            </text>
          </g>
        ))
      )}
    </svg>
  );
}

function Chip({ n, x, y, w }: { n: InjectChip; x: number; y: number; w: number }) {
  const taint = n.role === "taint";
  const stroke = n.active
    ? "var(--color-accent)"
    : taint
      ? "var(--color-glow-red)"
      : "var(--color-border)";
  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect
        width={w}
        height={ROW_H}
        rx={2}
        fill={taint ? "transparent" : "var(--color-raised)"}
        stroke={stroke}
        strokeDasharray={taint ? "3 2" : undefined}
      />
      <text
        x={8}
        y={18}
        fill={n.active ? "var(--color-accent)" : "var(--color-fg-muted)"}
        style={BODY}
      >
        {n.text}
      </text>
    </g>
  );
}

const STAMP = { font: "500 10px var(--font-plex-mono)", letterSpacing: "0.14em" } as const;
const TINY = { font: "500 9px var(--font-plex-mono)", letterSpacing: "0.12em" } as const;
const BODY = { font: "500 11px var(--font-plex-mono)" } as const;
