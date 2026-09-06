"use client";

import type { EventLoopState } from "./eventloop";

const VIEW_W = 800;
const PAD_X = 16;
const LABEL = 56;
const ROW_H = 28;
const GAP = 8;
const CH = 6.7;
const CHIP_PAD = 16;

export function EventLoopView({ state }: { state: EventLoopState }) {
  const w = Math.max(
    ...state.log.map((s) => s.length),
    ...state.micro.map((j) => j.label.length),
    ...state.macro.map((j) => j.label.length),
    3,
  ) * CH + CHIP_PAD;
  let y = 44;
  const logY = y;
  y += ROW_H + 16;
  const microY = y;
  y += ROW_H + 16;
  const macroY = y;
  y += ROW_H + 8;

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${y}`}
      className="block h-auto w-full"
      role="img"
      aria-label={`event loop, ${state.stamp}`}
    >
      <text x={PAD_X} y={16} fill="var(--color-fg-faint)" style={STAMP}>
        EVENT LOOP
      </text>
      <text x={PAD_X} y={30} fill="var(--color-fg-faint)" style={STAMP}>
        {state.stamp}
      </text>
      <Row name="log" y={logY} w={w} items={state.log.map((s) => ({ label: s, active: false, done: true }))} />
      <Row name="micro" y={microY} w={w} items={state.micro} />
      <Row name="macro" y={macroY} w={w} items={state.macro} />
    </svg>
  );
}

function Row({
  name,
  y,
  w,
  items,
}: {
  name: string;
  y: number;
  w: number;
  items: { label: string; active: boolean; done?: boolean }[];
}) {
  return (
    <g>
      <text x={PAD_X} y={y + 18} fill="var(--color-fg-faint)" style={TINY}>
        {name}
      </text>
      {items.length === 0 ? (
        <text x={PAD_X + LABEL} y={y + 18} fill="var(--color-fg-muted)" style={BODY}>
          empty
        </text>
      ) : (
        items.map((it, i) => (
          <g key={`${name}${i}`} transform={`translate(${PAD_X + LABEL + i * (w + GAP)}, ${y})`}>
            <rect
              width={w}
              height={ROW_H}
              rx={2}
              fill={it.done && !it.active ? "var(--color-raised)" : "transparent"}
              stroke={it.active ? "var(--color-accent)" : "var(--color-border)"}
              strokeDasharray={it.done ? undefined : "3 2"}
            />
            <text
              x={8}
              y={18}
              fill={it.active ? "var(--color-accent)" : "var(--color-fg-muted)"}
              style={BODY}
            >
              {it.label}
            </text>
          </g>
        ))
      )}
    </g>
  );
}

const STAMP = { font: "500 10px var(--font-plex-mono)", letterSpacing: "0.14em" } as const;
const TINY = { font: "500 9px var(--font-plex-mono)", letterSpacing: "0.12em" } as const;
const BODY = { font: "500 11px var(--font-plex-mono)" } as const;
