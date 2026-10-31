"use client";

import type { PriorityState, PrioTaskChip } from "./priority";

const VIEW_W = 800;
const PAD_X = 16;
const ROW_H = 28;
const CHIP_W = 72;

export function PriorityView({ state }: { state: PriorityState }) {
  const { inherit, cpu, lockHolder, lockWaiter, tasks, stamp } = state;
  let y = 44;
  const cpuY = y;
  y += ROW_H + 16;
  const lockY = y;
  y += ROW_H + 16;
  const taskY = y;
  y += tasks.length * (ROW_H + 6) + 12;

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${y}`}
      className="block h-auto w-full"
      role="img"
      aria-label={`priority ${inherit ? "with" : "without"} inheritance, t=${state.time}, cpu ${cpu ?? "idle"}`}
    >
      <text x={PAD_X} y={16} fill="var(--color-fg-faint)" style={STAMP}>
        {inherit ? "INHERITANCE" : "NO INHERITANCE"}
      </text>
      <text x={PAD_X} y={30} fill="var(--color-fg-faint)" style={STAMP}>
        {stamp}
      </text>

      <text x={PAD_X} y={cpuY - 4} fill="var(--color-fg-faint)" style={TINY}>
        CPU
      </text>
      <rect
        x={PAD_X}
        y={cpuY}
        width={CHIP_W}
        height={ROW_H}
        rx={2}
        fill={cpu ? "var(--color-raised)" : "transparent"}
        stroke={cpu ? "var(--color-accent)" : "var(--color-border)"}
        strokeDasharray={cpu ? undefined : "3 2"}
      />
      <text x={PAD_X + 8} y={cpuY + 18} fill="var(--color-accent)" style={BODY}>
        {cpu ?? "idle"}
      </text>

      <text x={PAD_X} y={lockY - 4} fill="var(--color-fg-faint)" style={TINY}>
        LOCK
      </text>
      <text x={PAD_X} y={lockY + 18} fill="var(--color-fg-muted)" style={BODY}>
        {lockHolder ? `held by ${lockHolder}` : "free"}
        {lockWaiter ? ` · ${lockWaiter} waits` : ""}
      </text>

      {tasks.map((t, i) => (
        <Task key={t.id} task={t} x={PAD_X} y={taskY + i * (ROW_H + 6)} />
      ))}
    </svg>
  );
}

function Task({ task, x, y }: { task: PrioTaskChip; x: number; y: number }) {
  const stroke =
    task.status === "running"
      ? "var(--color-accent)"
      : task.status === "blocked"
        ? "var(--color-glow-orange)"
        : task.status === "done"
          ? "var(--color-glow-green)"
          : "var(--color-border)";
  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect
        width={CHIP_W}
        height={ROW_H}
        rx={2}
        fill={task.status === "done" ? "var(--color-raised)" : "transparent"}
        stroke={stroke}
        strokeDasharray={task.status === "ready" || task.status === "blocked" ? "3 2" : undefined}
      />
      <text x={8} y={18} fill={task.status === "running" ? "var(--color-accent)" : "var(--color-fg-muted)"} style={BODY}>
        {task.id}
      </text>
      <text x={CHIP_W + 12} y={18} fill="var(--color-fg-muted)" style={BODY}>
        prio {task.priority}
        {task.effective !== task.priority ? ` →${task.effective}` : ""}
        {` ${task.remaining}/${task.burst}`}
        {task.status === "blocked" ? " blocked" : ""}
        {task.finishedAt !== null ? ` done@${task.finishedAt}` : ""}
      </text>
    </g>
  );
}

const STAMP = { font: "500 10px var(--font-plex-mono)", letterSpacing: "0.14em" } as const;
const TINY = { font: "500 9px var(--font-plex-mono)", letterSpacing: "0.12em" } as const;
const BODY = { font: "500 11px var(--font-plex-mono)" } as const;
