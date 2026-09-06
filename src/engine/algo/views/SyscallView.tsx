"use client";

import type { SyscallState } from "./syscall";

const VIEW_W = 800;
const PAD_X = 16;
const ROW_H = 36;

export function SyscallView({ state }: { state: SyscallState }) {
  const kernel = state.mode === "kernel";
  return (
    <svg
      viewBox={`0 0 ${VIEW_W} 120`}
      className="block h-auto w-full"
      role="img"
      aria-label={`syscall, ${state.stamp}`}
    >
      <text x={PAD_X} y={16} fill="var(--color-fg-faint)" style={STAMP}>
        SYSCALL
      </text>
      <text x={PAD_X} y={30} fill="var(--color-fg-faint)" style={STAMP}>
        {state.stamp}
      </text>
      <rect
        x={PAD_X}
        y={44}
        width={200}
        height={ROW_H}
        rx={2}
        fill={!kernel ? "var(--color-raised)" : "transparent"}
        stroke={!kernel ? "var(--color-accent)" : "var(--color-border)"}
      />
      <text x={PAD_X + 12} y={66} fill={!kernel ? "var(--color-accent)" : "var(--color-fg-muted)"} style={BODY}>
        USER
      </text>
      <rect
        x={PAD_X + 220}
        y={44}
        width={200}
        height={ROW_H}
        rx={2}
        fill={kernel ? "var(--color-raised)" : "transparent"}
        stroke={kernel ? "var(--color-accent)" : "var(--color-border)"}
      />
      <text x={PAD_X + 232} y={66} fill={kernel ? "var(--color-accent)" : "var(--color-fg-muted)"} style={BODY}>
        KERNEL
      </text>
      <text x={PAD_X} y={104} fill="var(--color-fg-muted)" style={BODY}>
        copied {state.copied} byte{state.copied === 1 ? "" : "s"}
        {state.last?.kind === "trap" ? " · trap" : ""}
        {state.last?.kind === "copy" ? ` · copy ${state.last.bytes}` : ""}
        {state.last?.kind === "return" ? " · return" : ""}
      </text>
    </svg>
  );
}

const STAMP = { font: "500 10px var(--font-plex-mono)", letterSpacing: "0.14em" } as const;
const BODY = { font: "500 11px var(--font-plex-mono)" } as const;
