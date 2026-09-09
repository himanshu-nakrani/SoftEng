"use client";

import type { ConcurrencyState, ThreadFrame } from "./threads";

const VIEW_W = 800;
const LANE_H = 62;
const HEADER_H = 74;
const PAD_X = 16;
/** Breathing room under the last lane. */
const CAPTION_H = 14;

/**
 * The interleaving stage: one lane per thread, shared memory above.
 *
 * Reads the same way the mental model does — what each thread has executed, who
 * holds which lock, and what the shared values are RIGHT NOW. The op the last
 * step ran is marked on its lane, so scrubbing backwards narrates the
 * interleaving instead of just rewinding numbers.
 *
 * Color language matches the rest of the engine: amber = the thread that just
 * ran · orange = blocked on a lock · green = finished · red = deadlock.
 */
export function ThreadsView({ state }: { state: ConcurrencyState }) {
  const { threads, memory, locks, active, deadlocked, livelocked } = state;
  const height = HEADER_H + threads.length * LANE_H + CAPTION_H;
  const memoryEntries = Object.entries(memory);
  const lockEntries = Object.entries(locks);

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${height}`}
      className="block h-auto w-full"
      role="img"
      aria-label={ariaLabel(state)}
    >
      {/* ---- shared memory + locks ---- */}
      <text
        x={PAD_X}
        y={20}
        fill="var(--color-fg-faint)"
        style={{ font: "500 10px var(--font-plex-mono)", letterSpacing: "0.14em" }}
      >
        SHARED
      </text>

      {memoryEntries.map(([key, value], i) => (
        <g key={key} transform={`translate(${PAD_X + i * 132}, 30)`}>
          <rect
            width={120}
            height={30}
            rx={2}
            fill="var(--color-raised)"
            stroke="var(--color-border)"
          />
          <text
            x={9}
            y={20}
            fill="var(--color-fg-muted)"
            style={{ font: "500 11px var(--font-plex-mono)" }}
          >
            {key}
          </text>
          <text
            x={111}
            y={20}
            textAnchor="end"
            fill="var(--color-accent)"
            style={{ font: "600 13px var(--font-plex-mono)" }}
          >
            {value}
          </text>
        </g>
      ))}

      {/* Locks continue the same row rather than hugging the right edge, where
          they collided with the figure's plate label. */}
      {lockEntries.map(([name, owner], i) => (
        <g
          key={name}
          transform={`translate(${PAD_X + (memoryEntries.length + i) * 132}, 30)`}
        >
          <rect
            width={120}
            height={30}
            rx={2}
            fill={owner ? "var(--color-accent-dim)" : "transparent"}
            stroke={owner ? "var(--color-accent)" : "var(--color-border)"}
          />
          <text
            x={9}
            y={20}
            fill={owner ? "var(--color-accent)" : "var(--color-fg-faint)"}
            style={{ font: "500 11px var(--font-plex-mono)" }}
          >
            {name}
          </text>
          <text
            x={111}
            y={20}
            textAnchor="end"
            fill={owner ? "var(--color-accent)" : "var(--color-fg-faint)"}
            style={{ font: "500 10px var(--font-plex-mono)" }}
          >
            {owner ?? "free"}
          </text>
        </g>
      ))}

      {/* ---- thread lanes ---- */}
      {threads.map((thread, row) => (
        <Lane
          key={thread.id}
          thread={thread}
          y={HEADER_H + row * LANE_H}
          justRan={active === thread.id}
          ranOp={active === thread.id ? state.ranOp : undefined}
          deadlocked={deadlocked || livelocked}
        />
      ))}
    </svg>
  );
}

function Lane({
  thread,
  y,
  justRan,
  ranOp,
  deadlocked,
}: {
  thread: ThreadFrame;
  y: number;
  justRan: boolean;
  ranOp?: string;
  deadlocked: boolean;
}) {
  const laneW = VIEW_W - PAD_X * 2 - 96;
  const cell = thread.ops > 0 ? laneW / thread.ops : laneW;
  const blocked = thread.status === "blocked";
  const done = thread.status === "done";

  const color = deadlocked && blocked
    ? "var(--color-glow-red)"
    : justRan
      ? "var(--color-accent)"
      : blocked
        ? "var(--color-glow-orange)"
        : done
          ? "var(--color-glow-green)"
          : "var(--color-border-bright)";

  return (
    <g transform={`translate(${PAD_X}, ${y})`}>
      <text
        x={0}
        y={16}
        fill={justRan ? "var(--color-fg)" : "var(--color-fg-muted)"}
        style={{ font: "500 12px var(--font-plex-mono)" }}
      >
        {thread.name}
      </text>

      {/* op cells: filled = executed */}
      {Array.from({ length: thread.ops }, (_, i) => {
        const executed = i < thread.pc;
        const isCurrent = i === thread.pc - 1 && justRan;
        return (
          <rect
            key={i}
            x={96 + i * cell + 1}
            y={4}
            width={Math.max(cell - 3, 2)}
            height={14}
            rx={2}
            fill={executed ? color : "var(--color-border)"}
            opacity={executed ? (isCurrent ? 1 : 0.5) : 0.35}
            style={{
              transition: "fill 140ms, opacity 140ms",
              filter: isCurrent ? `drop-shadow(0 0 5px ${color})` : undefined,
            }}
          />
        );
      })}

      {/* what it just did, or what it is waiting for */}
      <text
        x={96}
        y={34}
        fill={
          blocked
            ? deadlocked
              ? "var(--color-glow-red)"
              : "var(--color-glow-orange)"
            : justRan
              ? "var(--color-fg)"
              : "var(--color-fg-faint)"
        }
        style={{ font: "500 11px var(--font-plex-mono)" }}
      >
        {blocked
          ? `waiting for ${thread.waitingOn}`
          : done
            ? "done"
            : justRan && ranOp
              ? ranOp
              : thread.next
                ? `next: ${thread.next}`
                : ""}
      </text>

      {/* locals, right-aligned */}
      <text
        x={VIEW_W - PAD_X * 2}
        y={34}
        textAnchor="end"
        fill="var(--color-fg-faint)"
        style={{ font: "500 10px var(--font-plex-mono)" }}
      >
        {Object.entries(thread.locals)
          .map(([k, v]) => `${k}=${v}`)
          .join("  ")}
      </text>
    </g>
  );
}

/** One sentence a screen reader can act on, rebuilt per frame. */
function ariaLabel(state: ConcurrencyState): string {
  const shared = Object.entries(state.memory)
    .map(([k, v]) => `${k} is ${v}`)
    .join(", ");
  if (state.livelocked) {
    return `Livelock. Threads are still running but nothing is progressing. Shared memory: ${shared}.`;
  }
  if (state.deadlocked) {
    const waiting = state.threads
      .filter((t) => t.status === "blocked")
      .map((t) => `${t.name} waiting for ${t.waitingOn}`)
      .join("; ");
    return `Deadlock. ${waiting}. Shared memory: ${shared}.`;
  }
  const ran = state.active
    ? `${state.threads.find((t) => t.id === state.active)?.name} ran ${state.ranOp}`
    : "No thread has run yet";
  const done = state.threads.filter((t) => t.status === "done").length;
  return `${ran}. ${done} of ${state.threads.length} threads finished. Shared memory: ${shared}.`;
}
