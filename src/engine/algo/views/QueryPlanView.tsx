"use client";

import type { HeapPage, IndexNode, QueryPlanState } from "./queryPlan";

const VIEW_W = 800;
const PAD_X = 16;
const ROW_H = 28;
const CHIP_GAP = 8;
const CH = 6.7;
const CHIP_PAD = 18;

/**
 * Query-plan stage: an index above a heap, with the pages this step touched
 * lit. The one thing it has to make visible is that a secondary lookup is not
 * a range — each match is a separate heap fetch — while a scan is a walk of
 * every heap page and a clustered seek is a walk of contiguous ones.
 *
 * Top-right belongs to the figure's PlateLabel. The path name sits on the
 * left; the running page-read count sits in the middle.
 *
 * Grammar: solid green = a heap page already settled · amber = this step ·
 * dashed = a bookmark (a random fetch, not a scan).
 */
export function QueryPlanView({ state }: { state: QueryPlanState }) {
  const { path, heap, index, stamp } = state;
  const chipW = heapChipW(heap);
  const indexW = Math.max(chipW, 72);
  const stripW = VIEW_W - PAD_X * 2;
  const perRow = Math.max(1, Math.floor((stripW + CHIP_GAP) / (chipW + CHIP_GAP)));
  const heapAt = (i: number, originY: number) => ({
    x: PAD_X + (i % perRow) * (chipW + CHIP_GAP),
    y: originY + Math.floor(i / perRow) * (ROW_H + 6),
  });
  const heapRows = Math.max(1, Math.ceil(heap.length / perRow));
  const heapH = heapRows * ROW_H + (heapRows - 1) * 6;

  let y = 44;
  const indexY = y;
  y += ROW_H + 20;
  const heapLabelY = y;
  y += 14;
  const heapY = y;
  y += heapH + 16;
  const height = y;

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${height}`}
      className="block h-auto w-full"
      role="img"
      aria-label={ariaLabel(state)}
    >
      <text x={PAD_X} y={16} fill="var(--color-fg-faint)" style={STAMP}>
        {path === "scan" ? "TABLE SCAN" : path === "clustered" ? "CLUSTERED" : "SECONDARY"}
      </text>
      <text x={PAD_X} y={30} fill="var(--color-fg-faint)" style={STAMP}>
        {stamp}
      </text>

      {path === "scan" ? (
        <text x={PAD_X} y={indexY + 18} fill="var(--color-fg-faint)" style={BODY}>
          no index — every heap page
        </text>
      ) : (
        <>
          {index.map((node, i) => (
            <IndexChip
              key={node.id}
              node={node}
              x={PAD_X + i * (indexW + CHIP_GAP)}
              y={indexY}
              w={indexW}
            />
          ))}
        </>
      )}

      <text x={PAD_X} y={heapLabelY} fill="var(--color-fg-faint)" style={TINY}>
        HEAP
      </text>
      {heap.map((page, i) => {
        const pos = heapAt(i, heapY);
        return <HeapChip key={page.id} page={page} x={pos.x} y={pos.y} w={chipW} />;
      })}
    </svg>
  );
}

function heapChipW(pages: HeapPage[]): number {
  const widest = Math.max(...pages.map((p) => `${p.id} 4/4`.length), 8);
  return Math.round(widest * CH + CHIP_PAD);
}

function HeapChip({
  page,
  x,
  y,
  w,
}: {
  page: HeapPage;
  x: number;
  y: number;
  w: number;
}) {
  const stroke = page.bookmark
    ? "var(--color-accent)"
    : page.read
      ? "var(--color-glow-green)"
      : "var(--color-border)";
  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect
        width={w}
        height={ROW_H}
        rx={2}
        fill={page.read ? "var(--color-raised)" : "transparent"}
        stroke={stroke}
        strokeDasharray={page.bookmark ? "3 2" : undefined}
      />
      <text
        x={8}
        y={18}
        fill={page.read ? "var(--color-fg)" : "var(--color-fg-muted)"}
        style={BODY}
      >
        {page.id} {page.matches}/{page.rows}
      </text>
    </g>
  );
}

function IndexChip({
  node,
  x,
  y,
  w,
}: {
  node: IndexNode;
  x: number;
  y: number;
  w: number;
}) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect
        width={w}
        height={ROW_H}
        rx={2}
        fill={node.active ? "var(--color-raised)" : "transparent"}
        stroke={node.active ? "var(--color-accent)" : "var(--color-border)"}
      />
      <text
        x={8}
        y={18}
        fill={node.active ? "var(--color-accent)" : "var(--color-fg-muted)"}
        style={BODY}
      >
        {node.kind}
      </text>
    </g>
  );
}

function ariaLabel(state: QueryPlanState): string {
  return `${state.path} plan, ${state.matches} matches, ${state.stamp}.`;
}

const STAMP = {
  font: "500 10px var(--font-plex-mono)",
  letterSpacing: "0.14em",
} as const;
const TINY = { font: "500 9px var(--font-plex-mono)", letterSpacing: "0.12em" } as const;
const BODY = { font: "500 11px var(--font-plex-mono)" } as const;
