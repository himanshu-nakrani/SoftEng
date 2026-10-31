"use client";

import type { PolicyFact, PolicyRule, PolicyState } from "./policy";

const VIEW_W = 800;
const PAD_X = 16;
const ROW_H = 28;
const GAP = 8;
const CH = 6.7;
const CHIP_PAD = 18;

export function PolicyView({ state }: { state: PolicyState }) {
  const facts = [...state.subject, ...state.resource];
  const w = Math.max(
    ...facts.map((f) => `${f.label} ${f.value}`.length),
    ...state.rules.map((r) => r.label.length),
    8,
  ) * CH + CHIP_PAD;
  let y = 44;
  const subY = y;
  y += ROW_H + 16;
  const resY = y;
  y += ROW_H + 16;
  const ruleY = y;
  y += ROW_H + 20;
  const verdictY = y;
  y += 24;

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${y}`}
      className="block h-auto w-full"
      role="img"
      aria-label={`${state.kind}, ${state.stamp}`}
    >
      <text x={PAD_X} y={16} fill="var(--color-fg-faint)" style={STAMP}>
        {state.kind === "rbac" ? "RBAC" : "ABAC"}
      </text>
      <text x={PAD_X} y={30} fill="var(--color-fg-faint)" style={STAMP}>
        {state.stamp}
      </text>
      <text x={PAD_X} y={subY - 4} fill="var(--color-fg-faint)" style={TINY}>
        SUBJECT
      </text>
      {state.subject.map((f, i) => (
        <Fact key={`s${i}`} f={f} x={PAD_X + i * (w + GAP)} y={subY} w={w} />
      ))}
      <text x={PAD_X} y={resY - 4} fill="var(--color-fg-faint)" style={TINY}>
        RESOURCE
      </text>
      {state.resource.map((f, i) => (
        <Fact key={`r${i}`} f={f} x={PAD_X + i * (w + GAP)} y={resY} w={w} />
      ))}
      <text x={PAD_X} y={ruleY - 4} fill="var(--color-fg-faint)" style={TINY}>
        RULES
      </text>
      {state.rules.map((r, i) => (
        <Rule key={`u${i}`} r={r} x={PAD_X + i * (w + GAP)} y={ruleY} w={w} />
      ))}
      <text
        x={PAD_X}
        y={verdictY + 14}
        fill={state.allowed ? "var(--color-glow-green)" : "var(--color-glow-orange)"}
        style={BODY}
      >
        {state.allowed ? "allow" : "deny"}
      </text>
    </svg>
  );
}

function Fact({ f, x, y, w }: { f: PolicyFact; x: number; y: number; w: number }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect
        width={w}
        height={ROW_H}
        rx={2}
        fill="var(--color-raised)"
        stroke={f.active ? "var(--color-accent)" : "var(--color-border)"}
      />
      <text
        x={8}
        y={18}
        fill={f.active ? "var(--color-accent)" : "var(--color-fg-muted)"}
        style={BODY}
      >
        {f.label} {f.value}
      </text>
    </g>
  );
}

function Rule({ r, x, y, w }: { r: PolicyRule; x: number; y: number; w: number }) {
  const stroke = r.active
    ? "var(--color-accent)"
    : r.fired
      ? "var(--color-glow-green)"
      : "var(--color-border)";
  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect
        width={w}
        height={ROW_H}
        rx={2}
        fill={r.fired ? "var(--color-raised)" : "transparent"}
        stroke={stroke}
        strokeDasharray={r.fired ? undefined : "3 2"}
      />
      <text
        x={8}
        y={18}
        fill={r.active ? "var(--color-accent)" : "var(--color-fg-muted)"}
        style={BODY}
      >
        {r.label}
      </text>
    </g>
  );
}

const STAMP = { font: "500 10px var(--font-plex-mono)", letterSpacing: "0.14em" } as const;
const TINY = { font: "500 9px var(--font-plex-mono)", letterSpacing: "0.12em" } as const;
const BODY = { font: "500 11px var(--font-plex-mono)" } as const;
