"use client";

import type { JournalState } from "./journal";

const VIEW_W = 800;
const PAD_X = 16;
const ROW_H = 28;
const GAP = 8;
const CH = 6.7;
const CHIP_PAD = 16;

export function JournalView({ state }: { state: JournalState }) {
  const w = Math.round(6 * CH + CHIP_PAD);
  const at = (i: number) => PAD_X + i * (w + GAP);
  let y = 44;
  const dataY = y;
  y += ROW_H + 16;
  const inodeY = y;
  y += ROW_H + 16;
  const jY = y;
  y += ROW_H + 20;

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${y}`}
      className="block h-auto w-full"
      role="img"
      aria-label={`fs journal ${state.policy}, ${state.stamp}`}
    >
      <text x={PAD_X} y={16} fill="var(--color-fg-faint)" style={STAMP}>
        {state.policy === "journal" ? "JOURNALED" : "UNORDERED"}
      </text>
      <text x={PAD_X} y={30} fill="var(--color-fg-faint)" style={STAMP}>
        {state.stamp}
      </text>

      <text x={PAD_X} y={dataY - 4} fill="var(--color-fg-faint)" style={TINY}>
        DATA ON DISK
      </text>
      {state.dataOnDisk.length === 0 ? (
        <text x={PAD_X} y={dataY + 18} fill="var(--color-fg-faint)" style={BODY}>
          none
        </text>
      ) : (
        state.dataOnDisk.map((b, i) => (
          <Chip
            key={`d${i}`}
            label={`b${b}`}
            x={at(i)}
            y={dataY}
            w={w}
            active={state.last?.kind === "data" && state.last.block === b}
            wound={state.orphan && !state.inodeOnDisk.includes(b)}
          />
        ))
      )}

      <text x={PAD_X} y={inodeY - 4} fill="var(--color-fg-faint)" style={TINY}>
        INODE
      </text>
      {state.inodeOnDisk.length === 0 ? (
        <text x={PAD_X} y={inodeY + 18} fill="var(--color-fg-faint)" style={BODY}>
          empty
        </text>
      ) : (
        state.inodeOnDisk.map((b, i) => (
          <Chip
            key={`i${i}`}
            label={`b${b}`}
            x={at(i)}
            y={inodeY}
            w={w}
            active={state.last?.kind === "meta" && state.last.block === b}
          />
        ))
      )}

      <text x={PAD_X} y={jY - 4} fill="var(--color-fg-faint)" style={TINY}>
        JOURNAL
      </text>
      {state.policy !== "journal" ? (
        <text x={PAD_X} y={jY + 18} fill="var(--color-fg-faint)" style={BODY}>
          no log is kept
        </text>
      ) : state.journal.length === 0 ? (
        <text x={PAD_X} y={jY + 18} fill="var(--color-fg-faint)" style={BODY}>
          empty
        </text>
      ) : (
        state.journal.map((r, i) => (
          <Chip
            key={`j${i}`}
            label={`j${r.block}${r.forced ? "" : "?"}`}
            x={at(i)}
            y={jY}
            w={w}
            active={state.last?.kind === "jwrite" && state.last.block === r.block}
            hollow={!r.forced}
          />
        ))
      )}
    </svg>
  );
}

function Chip({
  label,
  x,
  y,
  w,
  active,
  wound,
  hollow,
}: {
  label: string;
  x: number;
  y: number;
  w: number;
  active?: boolean;
  wound?: boolean;
  hollow?: boolean;
}) {
  const stroke = wound
    ? "var(--color-glow-red)"
    : active
      ? "var(--color-accent)"
      : "var(--color-glow-green)";
  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect
        width={w}
        height={ROW_H}
        rx={2}
        fill={hollow || wound ? "transparent" : "var(--color-raised)"}
        stroke={stroke}
        strokeDasharray={hollow || wound ? "3 2" : undefined}
      />
      <text x={8} y={18} fill={wound ? "var(--color-glow-red)" : "var(--color-fg-muted)"} style={BODY}>
        {label}
      </text>
    </g>
  );
}

const STAMP = { font: "500 10px var(--font-plex-mono)", letterSpacing: "0.14em" } as const;
const TINY = { font: "500 9px var(--font-plex-mono)", letterSpacing: "0.12em" } as const;
const BODY = { font: "500 11px var(--font-plex-mono)" } as const;
