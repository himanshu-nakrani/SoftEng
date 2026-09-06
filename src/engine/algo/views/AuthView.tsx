"use client";

import type { AuthChip, AuthLane, AuthState } from "./auth";

const VIEW_W = 800;
const PAD_X = 16;
const LABEL = 72;
const ROW_H = 28;
const GAP = 8;
const CH = 6.7;
const CHIP_PAD = 18;

export function AuthView({ state }: { state: AuthState }) {
  const chips = state.lanes.flatMap((l) => l.chips);
  const w = Math.max(
    ...chips.map((c) => `${c.label} ${c.value}`.length),
    6,
  ) * CH + CHIP_PAD;
  const inner = VIEW_W - PAD_X - LABEL;
  const per = Math.max(1, Math.floor((inner + GAP) / (w + GAP)));

  let y = 44;
  const rows: { lane: AuthLane; y: number; h: number }[] = [];
  for (const lane of state.lanes) {
    const n = Math.max(1, lane.chips.length);
    const h = Math.ceil(n / per) * (ROW_H + GAP);
    rows.push({ lane, y, h });
    y += h + 10;
  }
  y += 4;

  const title =
    state.kind === "session" ? "SESSION" : state.kind === "jwt" ? "JWT" : "OAUTH";

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${Math.max(y, 80)}`}
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
      {rows.map(({ lane, y: ly }) => (
        <g key={lane.name}>
          <text x={PAD_X} y={ly + 18} fill="var(--color-fg-faint)" style={TINY}>
            {lane.name}
          </text>
          {lane.chips.map((c, i) => (
            <Chip
              key={`${lane.name}${i}`}
              c={c}
              x={PAD_X + LABEL + (i % per) * (w + GAP)}
              y={ly + Math.floor(i / per) * (ROW_H + GAP)}
              w={w}
            />
          ))}
        </g>
      ))}
    </svg>
  );
}

function Chip({ c, x, y, w }: { c: AuthChip; x: number; y: number; w: number }) {
  const stroke =
    c.active || c.tone === "active"
      ? "var(--color-accent)"
      : c.tone === "bad"
        ? "var(--color-glow-red)"
        : c.tone === "warn"
          ? "var(--color-glow-orange)"
          : c.tone === "ok"
            ? "var(--color-glow-green)"
            : "var(--color-border)";
  const hollow = c.tone === "bad" || c.tone === "warn";
  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect
        width={w}
        height={ROW_H}
        rx={2}
        fill={hollow ? "transparent" : "var(--color-raised)"}
        stroke={stroke}
        strokeDasharray={hollow ? "3 2" : undefined}
      />
      <text
        x={8}
        y={18}
        fill={c.active ? "var(--color-accent)" : "var(--color-fg-muted)"}
        style={BODY}
      >
        {c.label} {c.value}
      </text>
    </g>
  );
}

const STAMP = { font: "500 10px var(--font-plex-mono)", letterSpacing: "0.14em" } as const;
const TINY = { font: "500 9px var(--font-plex-mono)", letterSpacing: "0.12em" } as const;
const BODY = { font: "500 11px var(--font-plex-mono)" } as const;
