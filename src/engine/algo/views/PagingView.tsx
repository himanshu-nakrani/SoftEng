"use client";

import type { FrameChip, PagingState, PteChip, TlbChip } from "./paging";

const VIEW_W = 800;
const PAD_X = 16;
const ROW_H = 28;
const CHIP_GAP = 8;
const CH = 6.7;
const CHIP_PAD = 16;

/**
 * Virtual-memory stage: directory, the L2 table just walked, optional TLB,
 * and physical frames. Top-right belongs to the figure's PlateLabel — stamps
 * sit on the left. Amber = this step, green = present/mapped, dashed = empty
 * or invalid, red = the victim.
 */
export function PagingView({ state }: { state: PagingState }) {
  const { directory, table, tlb, frames, tlbEnabled, stamp } = state;
  const chipW = Math.max(pageChipW(directory), pageChipW(table), 72);
  const frameW = Math.max(frameChipW(frames), 56);

  let y = 44;
  const dirY = y;
  y += ROW_H + 16;
  const tableY = y;
  y += ROW_H + 16;
  const tlbY = y;
  if (tlbEnabled) {
    y += ROW_H + 16;
  }
  const frameLabelY = y;
  y += 12;
  const frameY = y;
  const stripW = VIEW_W - PAD_X * 2;
  const perRow = Math.max(1, Math.floor((stripW + CHIP_GAP) / (frameW + CHIP_GAP)));
  const frameRows = Math.max(1, Math.ceil(frames.length / perRow));
  y += frameRows * (ROW_H + 6) + 10;
  const height = y;

  const at = (i: number, w: number) => PAD_X + i * (w + CHIP_GAP);
  const frameAt = (i: number) => ({
    x: PAD_X + (i % perRow) * (frameW + CHIP_GAP),
    y: frameY + Math.floor(i / perRow) * (ROW_H + 6),
  });

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${height}`}
      className="block h-auto w-full"
      role="img"
      aria-label={ariaLabel(state)}
    >
      <text x={PAD_X} y={16} fill="var(--color-fg-faint)" style={STAMP}>
        PAGING
      </text>
      <text x={PAD_X} y={30} fill="var(--color-fg-faint)" style={STAMP}>
        {stamp}
      </text>

      <text x={PAD_X} y={dirY - 4} fill="var(--color-fg-faint)" style={TINY}>
        DIRECTORY
      </text>
      {directory.map((e, i) => (
        <Pte key={`d${i}`} chip={e} x={at(i, chipW)} y={dirY} w={chipW} />
      ))}

      <text x={PAD_X} y={tableY - 4} fill="var(--color-fg-faint)" style={TINY}>
        TABLE
      </text>
      {table.length === 0 ? (
        <text x={PAD_X} y={tableY + 18} fill="var(--color-fg-faint)" style={BODY}>
          {state.last?.kind === "tlb-hit" ? "walk skipped" : "not walked"}
        </text>
      ) : (
        table.map((e, i) => (
          <Pte key={`t${i}`} chip={e} x={at(i, chipW)} y={tableY} w={chipW} />
        ))
      )}

      {tlbEnabled && (
        <>
          <text x={PAD_X} y={tlbY - 4} fill="var(--color-fg-faint)" style={TINY}>
            TLB
          </text>
          {tlb.length === 0 ? (
            <text x={PAD_X} y={tlbY + 18} fill="var(--color-fg-faint)" style={BODY}>
              empty
            </text>
          ) : (
            tlb.map((e, i) => (
              <Tlb key={`b${i}`} chip={e} x={at(i, chipW)} y={tlbY} w={chipW} />
            ))
          )}
        </>
      )}

      <text x={PAD_X} y={frameLabelY} fill="var(--color-fg-faint)" style={TINY}>
        FRAMES
      </text>
      {frames.map((f, i) => {
        const pos = frameAt(i);
        return <Frame key={`f${i}`} chip={f} x={pos.x} y={pos.y} w={frameW} />;
      })}
    </svg>
  );
}

function pageChipW(chips: PteChip[]): number {
  if (chips.length === 0) return 72;
  const widest = Math.max(...chips.map((c) => c.label.length + 4), 4);
  return Math.round(widest * CH + CHIP_PAD);
}

function frameChipW(chips: FrameChip[]): number {
  return Math.round((chips.length > 9 ? 8 : 6) * CH + CHIP_PAD);
}

function Pte({ chip, x, y, w }: { chip: PteChip; x: number; y: number; w: number }) {
  const hollow = !chip.present;
  const stroke = chip.active
    ? "var(--color-accent)"
    : hollow
      ? "var(--color-border)"
      : "var(--color-glow-green)";
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
        fill={chip.active ? "var(--color-accent)" : "var(--color-fg-muted)"}
        style={BODY}
      >
        {chip.label}
        {chip.present && chip.pfn !== null ? ` →${chip.pfn}` : ""}
      </text>
    </g>
  );
}

function Tlb({ chip, x, y, w }: { chip: TlbChip; x: number; y: number; w: number }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect
        width={w}
        height={ROW_H}
        rx={2}
        fill="var(--color-raised)"
        stroke={chip.active ? "var(--color-accent)" : "var(--color-glow-green)"}
      />
      <text
        x={8}
        y={18}
        fill={chip.active ? "var(--color-accent)" : "var(--color-fg)"}
        style={BODY}
      >
        {chip.vpn}→{chip.pfn}
      </text>
    </g>
  );
}

function Frame({ chip, x, y, w }: { chip: FrameChip; x: number; y: number; w: number }) {
  const empty = chip.vpn === null;
  const stroke = chip.victim
    ? "var(--color-glow-red)"
    : empty
      ? "var(--color-border)"
      : "var(--color-glow-green)";
  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect
        width={w}
        height={ROW_H}
        rx={2}
        fill={empty ? "transparent" : "var(--color-raised)"}
        stroke={stroke}
        strokeDasharray={empty ? "3 2" : undefined}
      />
      <text x={8} y={18} fill={chip.victim ? "var(--color-glow-red)" : "var(--color-fg-muted)"} style={BODY}>
        {empty ? `f${chip.pfn}` : `f${chip.pfn}:${chip.vpn}`}
      </text>
    </g>
  );
}

function ariaLabel(state: PagingState): string {
  const op = state.last ? `${state.last.kind} VPN ${state.last.vpn}` : "start";
  return `paging, ${op}. ${state.stamp}.`;
}

const STAMP = {
  font: "500 10px var(--font-plex-mono)",
  letterSpacing: "0.14em",
} as const;
const TINY = { font: "500 9px var(--font-plex-mono)", letterSpacing: "0.12em" } as const;
const BODY = { font: "500 11px var(--font-plex-mono)" } as const;
