"use client";

import type { SchedTaskChip, SchedulerState } from "./scheduler";

const VIEW_W = 800;
const PAD_X = 16;
const ROW_H = 28;
const CHIP_GAP = 8;
const CH = 6.7;
const CHIP_PAD = 18;

/**
 * Scheduler stage: the CPU, the ready queue, and each task's remaining burst.
 * Top-right is the figure's PlateLabel. Left stamps name the policy.
 *
 * Amber = running, green = done, dashed = ready. The convoy is the short
 * task still ready while a long one occupies the CPU.
 */
export function SchedulerView({ state }: { state: SchedulerState }) {
  const { policy, cpu, queue, levels, tasks, stamp } = state;
  const chipW = Math.max(
    ...tasks.map((t) => t.id.length + 4),
    6,
  ) * CH + CHIP_PAD;
  const at = (i: number) => PAD_X + i * (chipW + CHIP_GAP);

  let y = 44;
  const cpuY = y;
  y += ROW_H + 18;
  const qY = y;
  const levelCount = levels?.length ?? 0;
  y += (levelCount > 0 ? levelCount : 1) * (ROW_H + 14);
  const taskY = y;
  y += tasks.length * (ROW_H + 6) + 12;
  const height = y;

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${height}`}
      className="block h-auto w-full"
      role="img"
      aria-label={ariaLabel(state)}
    >
      <text x={PAD_X} y={16} fill="var(--color-fg-faint)" style={STAMP}>
        {policy === "cooperative"
          ? "COOPERATIVE"
          : policy === "mlfq"
            ? "MLFQ"
            : "PREEMPTIVE"}
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
        width={chipW}
        height={ROW_H}
        rx={2}
        fill={cpu ? "var(--color-raised)" : "transparent"}
        stroke={cpu ? "var(--color-accent)" : "var(--color-border)"}
        strokeDasharray={cpu ? undefined : "3 2"}
      />
      <text x={PAD_X + 8} y={cpuY + 18} fill="var(--color-accent)" style={BODY}>
        {cpu ?? "idle"}
      </text>

      {levels && levels.length > 0 ? (
        levels.map((q, li) => (
          <g key={`q${li}`}>
            <text
              x={PAD_X}
              y={qY + li * (ROW_H + 14) - 4}
              fill="var(--color-fg-faint)"
              style={TINY}
            >
              Q{li}
            </text>
            {q.length === 0 ? (
              <text
                x={PAD_X}
                y={qY + li * (ROW_H + 14) + 18}
                fill="var(--color-fg-faint)"
                style={BODY}
              >
                empty
              </text>
            ) : (
              q.map((id, i) => (
                <g
                  key={id}
                  transform={`translate(${at(i)}, ${qY + li * (ROW_H + 14)})`}
                >
                  <rect
                    width={chipW}
                    height={ROW_H}
                    rx={2}
                    fill="transparent"
                    stroke="var(--color-border)"
                    strokeDasharray="3 2"
                  />
                  <text x={8} y={18} fill="var(--color-fg-muted)" style={BODY}>
                    {id}
                  </text>
                </g>
              ))
            )}
          </g>
        ))
      ) : (
        <>
          <text x={PAD_X} y={qY - 4} fill="var(--color-fg-faint)" style={TINY}>
            READY
          </text>
          {queue.length === 0 ? (
            <text x={PAD_X} y={qY + 18} fill="var(--color-fg-faint)" style={BODY}>
              empty
            </text>
          ) : (
            queue.map((id, i) => (
              <g key={id} transform={`translate(${at(i)}, ${qY})`}>
                <rect
                  width={chipW}
                  height={ROW_H}
                  rx={2}
                  fill="transparent"
                  stroke="var(--color-border)"
                  strokeDasharray="3 2"
                />
                <text x={8} y={18} fill="var(--color-fg-muted)" style={BODY}>
                  {id}
                </text>
              </g>
            ))
          )}
        </>
      )}

      {tasks.map((task, i) => (
        <TaskRow key={task.id} task={task} x={PAD_X} y={taskY + i * (ROW_H + 6)} w={chipW} />
      ))}
    </svg>
  );
}

function TaskRow({
  task,
  x,
  y,
  w,
}: {
  task: SchedTaskChip;
  x: number;
  y: number;
  w: number;
}) {
  const stroke =
    task.status === "running"
      ? "var(--color-accent)"
      : task.status === "done"
        ? "var(--color-glow-green)"
        : "var(--color-border)";
  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect
        width={w}
        height={ROW_H}
        rx={2}
        fill={task.status === "done" ? "var(--color-raised)" : "transparent"}
        stroke={stroke}
        strokeDasharray={task.status === "ready" ? "3 2" : undefined}
      />
      <text x={8} y={18} fill={task.status === "running" ? "var(--color-accent)" : "var(--color-fg-muted)"} style={BODY}>
        {task.id}
      </text>
      <text x={w + 12} y={18} fill="var(--color-fg-muted)" style={BODY}>
        {task.remaining}/{task.burst}
        {task.level !== undefined ? ` Q${task.level}` : ""}
        {task.finishedAt !== null ? ` done@${task.finishedAt}` : ""}
      </text>
    </g>
  );
}

function ariaLabel(state: SchedulerState): string {
  return `${state.policy} scheduler, t=${state.time}, cpu ${state.cpu ?? "idle"}. ${state.stamp}.`;
}

const STAMP = {
  font: "500 10px var(--font-plex-mono)",
  letterSpacing: "0.14em",
} as const;
const TINY = { font: "500 9px var(--font-plex-mono)", letterSpacing: "0.12em" } as const;
const BODY = { font: "500 11px var(--font-plex-mono)" } as const;
