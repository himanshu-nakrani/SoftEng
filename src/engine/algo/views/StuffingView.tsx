"use client";

import type { StuffAttempt, StuffBucket, StuffingState } from "./stuffing";

const VIEW_W = 800;
const PAD_X = 16;
const ROW_H = 28;
const GAP = 8;
const CH = 6.7;
const CHIP_PAD = 16;

export function StuffingView({ state }: { state: StuffingState }) {
  const aw = Math.max(
    ...state.attempts.map((a) => {
      const extra = a.result === "pending" ? "" : ` ${a.result}`;
      return `${a.n} ${a.user}@${a.ip}${extra}`.length;
    }),
    8,
  ) * CH + CHIP_PAD;
  const bw = Math.max(
    ...state.buckets.map((b) => `${b.key} ${b.tokens}/${b.cap}`.length),
    6,
  ) * CH + CHIP_PAD;
  const inner = VIEW_W - PAD_X * 2;
  const perA = Math.max(1, Math.floor((inner + GAP) / (aw + GAP)));
  const aRows = Math.max(1, Math.ceil(state.attempts.length / perA));
  let y = 44;
  const aY = y;
  y += aRows * (ROW_H + GAP) + 16;
  const bY = y;
  y += ROW_H + 12;

  const title =
    state.policy === "none" ? "NO LIMIT" : state.policy === "ip" ? "IP BUCKET" : "USER BUCKET";

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${y}`}
      className="block h-auto w-full"
      role="img"
      aria-label={`stuffing ${state.policy}, ${state.stamp}`}
    >
      <text x={PAD_X} y={16} fill="var(--color-fg-faint)" style={STAMP}>
        {title}
      </text>
      <text x={PAD_X} y={30} fill="var(--color-fg-faint)" style={STAMP}>
        {state.stamp}
      </text>
      {state.attempts.map((a, i) => (
        <Attempt
          key={a.n}
          a={a}
          x={PAD_X + (i % perA) * (aw + GAP)}
          y={aY + Math.floor(i / perA) * (ROW_H + GAP)}
          w={aw}
        />
      ))}
      <text x={PAD_X} y={bY - 4} fill="var(--color-fg-faint)" style={TINY}>
        BUCKETS
      </text>
      {state.buckets.length === 0 ? (
        <text x={PAD_X} y={bY + 18} fill="var(--color-fg-muted)" style={BODY}>
          none
        </text>
      ) : (
        state.buckets.map((b, i) => (
          <Bucket key={b.key} b={b} x={PAD_X + i * (bw + GAP)} y={bY} w={bw} />
        ))
      )}
    </svg>
  );
}

function Attempt({ a, x, y, w }: { a: StuffAttempt; x: number; y: number; w: number }) {
  const stroke =
    a.active
      ? "var(--color-accent)"
      : a.result === "ok"
        ? "var(--color-glow-red)"
        : a.result === "block"
          ? "var(--color-glow-orange)"
          : a.result === "fail"
            ? "var(--color-border)"
            : "var(--color-border)";
  const hollow = a.result === "ok" || a.result === "block" || a.result === "pending";
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
        fill={a.active ? "var(--color-accent)" : "var(--color-fg-muted)"}
        style={BODY}
      >
        {a.n} {a.user}@{a.ip} {a.result === "pending" ? "" : a.result}
      </text>
    </g>
  );
}

function Bucket({ b, x, y, w }: { b: StuffBucket; x: number; y: number; w: number }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect
        width={w}
        height={ROW_H}
        rx={2}
        fill="var(--color-raised)"
        stroke="var(--color-border)"
      />
      <text x={8} y={18} fill="var(--color-fg-muted)" style={BODY}>
        {b.key} {b.tokens}/{b.cap}
      </text>
    </g>
  );
}

const STAMP = { font: "500 10px var(--font-plex-mono)", letterSpacing: "0.14em" } as const;
const TINY = { font: "500 9px var(--font-plex-mono)", letterSpacing: "0.12em" } as const;
const BODY = { font: "500 11px var(--font-plex-mono)" } as const;
