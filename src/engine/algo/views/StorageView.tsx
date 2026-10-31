"use client";

import type { StoragePage, StorageState } from "./storage";

const VIEW_W = 800;
const PAD_X = 16;
const ROW_H = 28;
const CHIP_GAP = 8;
const CH = 6.7;
const CHIP_PAD = 16;

/**
 * B-tree vs LSM stage: the live pages of whichever engine is running.
 *
 * The one thing this view exists to make visible is amplification — a logical
 * write that rewrites a whole B-tree leaf, versus an append that only becomes
 * a page write at flush. So pages are chips, the touched one is amber, an
 * LSM memtable is hollow (it is not yet a page), and a bloom skip is dashed
 * with a MISS mark rather than silent. The top-right corner belongs to the
 * figure's PlateLabel; the engine name sits on the left, the verdict in the
 * middle of the stage.
 *
 * Grammar shared with WAL: dashed and hollow = not a page yet · solid = on
 * disk · amber = this step · faint MISS = bloom skip.
 */
export function StorageView({ state }: { state: StorageState }) {
  const { engine, pages, stamp, lastOp, found } = state;
  const leaves = pages.filter((p) => p.kind === "leaf");
  const root = pages.find((p) => p.kind === "root");
  const memtable = pages.find((p) => p.kind === "memtable");
  const sstables = pages.filter((p) => p.kind === "sstable");

  const chipW = pageChipW(pages);
  const stripW = VIEW_W - PAD_X * 2;
  const perRow = Math.max(1, Math.floor((stripW + CHIP_GAP) / (chipW + CHIP_GAP)));
  const at = (i: number, originY: number) => ({
    x: PAD_X + (i % perRow) * (chipW + CHIP_GAP),
    y: originY + Math.floor(i / perRow) * (ROW_H + 6),
  });
  const bandH = (n: number) => {
    const rows = Math.max(1, Math.ceil(n / perRow));
    return rows * ROW_H + (rows - 1) * 6;
  };

  let y = 44;
  const rootY = y;
  let leafY = y;
  let memLabelY = y;
  let memY = y;
  let sstLabelY = y;
  let sstY = y;
  if (engine === "btree") {
    y += ROW_H + 16;
    leafY = y;
    y += bandH(Math.max(leaves.length, 1)) + 16;
  } else {
    memLabelY = y;
    y += 12;
    memY = y;
    y += ROW_H + 14;
    sstLabelY = y;
    y += 12;
    sstY = y;
    y += bandH(Math.max(sstables.length, 1)) + 16;
  }
  const height = y + 12;

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${height}`}
      className="block h-auto w-full"
      role="img"
      aria-label={ariaLabel(state)}
    >
      <text x={PAD_X} y={16} fill="var(--color-fg-faint)" style={STAMP}>
        {engine === "btree" ? "B-TREE" : "LSM"}
      </text>
      <text x={PAD_X} y={30} fill="var(--color-fg-faint)" style={STAMP}>
        {stamp}
      </text>

      {engine === "btree" && root && (
        <>
          <PageChip page={root} x={PAD_X} y={rootY} w={chipW} />
          {leaves.map((leaf, i) => {
            const pos = at(i, leafY);
            return <PageChip key={leaf.id} page={leaf} x={pos.x} y={pos.y} w={chipW} />;
          })}
        </>
      )}

      {engine === "lsm" && memtable && (
        <>
          <text x={PAD_X} y={memLabelY} fill="var(--color-fg-faint)" style={TINY}>
            MEMTABLE — not yet a page
          </text>
          <PageChip
            page={memtable}
            x={PAD_X}
            y={memY}
            w={Math.min(chipW * 2, stripW)}
          />
          <text x={PAD_X} y={sstLabelY} fill="var(--color-fg-faint)" style={TINY}>
            SSTABLES
          </text>
          {sstables.length === 0 ? (
            <text x={PAD_X} y={sstY + 16} fill="var(--color-fg-faint)" style={BODY}>
              none flushed
            </text>
          ) : (
            sstables.map((table, i) => {
              const pos = at(i, sstY);
              return (
                <PageChip key={table.id} page={table} x={pos.x} y={pos.y} w={chipW} />
              );
            })
          )}
        </>
      )}

      {lastOp?.kind === "read" && found === false && (
        <text
          x={VIEW_W / 2}
          y={height - 4}
          textAnchor="middle"
          fill="var(--color-fg-muted)"
          style={TINY}
        >
          miss
        </text>
      )}
    </svg>
  );
}

function pageChipW(pages: StoragePage[]): number {
  const widest = Math.max(
    ...pages.map((p) => Math.max(p.id.length, p.keys.join(" ").length, 6)),
    8,
  );
  return Math.round(widest * CH + CHIP_PAD);
}

function PageChip({
  page,
  x,
  y,
  w,
}: {
  page: StoragePage;
  x: number;
  y: number;
  w: number;
}) {
  const volatile = page.kind === "memtable";
  const empty = page.keys.length === 0 && page.kind !== "root";
  const hollow = volatile || page.bloomSkip || empty;
  const stroke = page.active
    ? "var(--color-accent)"
    : page.bloomSkip
      ? "var(--color-fg-faint)"
      : hollow
        ? "var(--color-border)"
        : "var(--color-glow-green)";
  const label = page.keys.length > 0 ? page.keys.join(" ") : page.id;
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
        fill={
          page.active
            ? "var(--color-accent)"
            : volatile
              ? "var(--color-fg-muted)"
              : "var(--color-fg)"
        }
        style={BODY}
      >
        {page.kind === "root" ? "root" : label}
      </text>
      {page.bloomSkip && (
        <text
          x={w - 7}
          y={18}
          textAnchor="end"
          fill="var(--color-fg-faint)"
          style={TINY}
        >
          MISS
        </text>
      )}
    </g>
  );
}

function ariaLabel(state: StorageState): string {
  const op = state.lastOp
    ? `${state.lastOp.kind}${state.lastOp.key ? ` ${state.lastOp.key}` : ""}`
    : "start";
  return `${state.engine} storage, ${op}. ${state.stamp}.`;
}

const STAMP = {
  font: "500 10px var(--font-plex-mono)",
  letterSpacing: "0.14em",
} as const;
const TINY = { font: "500 9px var(--font-plex-mono)", letterSpacing: "0.12em" } as const;
const BODY = { font: "500 11px var(--font-plex-mono)" } as const;
