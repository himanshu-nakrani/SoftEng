"use client";

import type { LexerState, TokenChip } from "./lexer";

const VIEW_W = 800;
const PAD_X = 16;
const ROW_H = 28;
const GAP = 8;
const CH = 6.7;
const CHIP_PAD = 18;
const CHAR_W = 14;

export function LexerView({ state }: { state: LexerState }) {
  const w = Math.max(
    ...state.tokens.map((t) => `${t.kind} ${t.lexeme}`.length),
    6,
  ) * CH + CHIP_PAD;
  const inner = VIEW_W - PAD_X * 2;
  const per = Math.max(1, Math.floor((inner + GAP) / (w + GAP)));
  const tRows = Math.max(1, Math.ceil(Math.max(state.tokens.length, 1) / per));
  let y = 44;
  const srcY = y;
  y += 28;
  const tokY = y;
  y += tRows * (ROW_H + GAP) + 8;

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${y}`}
      className="block h-auto w-full"
      role="img"
      aria-label={`lexer, ${state.stamp}`}
    >
      <text x={PAD_X} y={16} fill="var(--color-fg-faint)" style={STAMP}>
        LEXER
      </text>
      <text x={PAD_X} y={30} fill="var(--color-fg-faint)" style={STAMP}>
        {state.stamp}
      </text>
      {[...state.source].map((ch, i) => (
        <text
          key={i}
          x={PAD_X + i * CHAR_W}
          y={srcY + 16}
          fill={i === state.cursor ? "var(--color-accent)" : i < state.cursor ? "var(--color-fg-muted)" : "var(--color-fg-faint)"}
          style={BODY}
        >
          {ch === " " ? "·" : ch}
        </text>
      ))}
      {state.tokens.map((t, i) => (
        <Tok
          key={i}
          t={t}
          x={PAD_X + (i % per) * (w + GAP)}
          y={tokY + Math.floor(i / per) * (ROW_H + GAP)}
          w={w}
        />
      ))}
    </svg>
  );
}

function Tok({ t, x, y, w }: { t: TokenChip; x: number; y: number; w: number }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect
        width={w}
        height={ROW_H}
        rx={2}
        fill={t.active ? "transparent" : "var(--color-raised)"}
        stroke={t.active ? "var(--color-accent)" : "var(--color-border)"}
        strokeDasharray={t.active ? "3 2" : undefined}
      />
      <text
        x={8}
        y={18}
        fill={t.active ? "var(--color-accent)" : "var(--color-fg-muted)"}
        style={BODY}
      >
        {t.kind} {t.lexeme}
      </text>
    </g>
  );
}

const STAMP = { font: "500 10px var(--font-plex-mono)", letterSpacing: "0.14em" } as const;
const BODY = { font: "500 11px var(--font-plex-mono)" } as const;
