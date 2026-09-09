"use client";

import type { MvccTxnFrame, VersionFrame, VersionsState } from "./versions";

const VIEW_W = 800;
const PAD_X = 16;
const CHIP_W = 128;
const CHIP_H = 34;
const CHIP_GAP = 34;
const ROW_GAP = 14;
/** Approximate mono advance at 12px — enough to size a column from its content. */
const CH = 7.2;
/** Columns inside a transaction row, measured from the name's left edge. */
const SNAP_COL = 108;
const STATUS_COL = 208;

/**
 * The version-chain stage: every row drawn as its chain of versions, oldest on
 * the left, and each transaction's snapshot timestamp below.
 *
 * The one thing this view exists to make visible is that a row is not a cell but
 * a CHAIN, and that an old version stays readable because a newer one sits
 * BESIDE it rather than on top of it. So versions are laid left to right with an
 * arrow between them, a committed version is solid with its commit time, an
 * uncommitted one is hollow and dashed, and an aborted one is red and struck
 * through. When a reader picks a version its snapshot can see, that version is
 * ringed — which is the whole lesson in one mark.
 *
 * Grammar shared with the transaction and durability views, so a reader carries
 * it across: dashed and hollow = not settled · solid green = committed fact ·
 * amber = the thing this step touched · red = a wound (here, an aborted version).
 */
export function VersionsView({ state }: { state: VersionsState }) {
  const { rows, txns, clock, snapshotNote, conflict } = state;

  // The version chains only need room for the widest ROW KEY before the first
  // chip. Transaction names are laid out on their own row below, with fixed
  // columns, so they do not constrain this offset.
  const keyW = Math.max(...rows.map((r) => r.key.length), 6);
  const rowLabelCol = Math.round(keyW * CH + 14);
  // The transaction rows need room for the widest NAME before the snapshot
  // column, sized once and shared so no name reaches into it.
  const nameW = Math.max(...txns.map((t) => t.name.length), 10);
  const nameCol = Math.max(SNAP_COL, Math.round(nameW * CH + 14));

  let y = 34;
  const rowTop = y;
  y += rows.length * (CHIP_H + ROW_GAP) + 8;
  const dividerY = y - 6;
  const txnTop = y;
  y += txns.length * 22 + 8;
  const footer = y;
  const height = footer + (snapshotNote || conflict ? 16 : 0);

  const chipAt = (i: number) => PAD_X + rowLabelCol + i * (CHIP_W + CHIP_GAP);

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${height}`}
      className="block h-auto w-full"
      role="img"
      aria-label={ariaLabel(state)}
    >
      {/* Left only: the figure's own PlateLabel owns the top-right corner. */}
      <text x={PAD_X} y={16} fill="var(--color-fg-faint)" style={STAMP}>
        VERSIONS · SNAPSHOT ISOLATION
      </text>
      {/* The logical clock, anchored in the middle of the stage so it stays
          clear of the top-right PlateLabel. */}
      <text
        x={VIEW_W / 2}
        y={16}
        textAnchor="middle"
        fill="var(--color-fg-faint)"
        style={STAMP}
      >
        clock @ {clock}
      </text>

      {rows.map((row, i) => (
        <g key={row.key} transform={`translate(0, ${rowTop + i * (CHIP_H + ROW_GAP)})`}>
          <text x={PAD_X} y={CHIP_H / 2 + 4} fill="var(--color-fg-muted)" style={BODY}>
            {row.key}
          </text>
          {row.versions.map((v, j) => (
            <g key={`${v.beginTs}`}>
              {j > 0 && (
                <line
                  x1={chipAt(j - 1) + CHIP_W}
                  y1={CHIP_H / 2}
                  x2={chipAt(j)}
                  y2={CHIP_H / 2}
                  stroke="var(--color-border)"
                  markerEnd="url(#vArrow)"
                />
              )}
              <VersionChip version={v} x={chipAt(j)} />
            </g>
          ))}
        </g>
      ))}

      <defs>
        <marker
          id="vArrow"
          markerWidth="6"
          markerHeight="6"
          refX="5"
          refY="3"
          orient="auto"
        >
          <path d="M0,0 L6,3 L0,6 Z" fill="var(--color-border)" />
        </marker>
      </defs>

      {/* hairline between the rows and the transactions reading them */}
      <line
        x1={PAD_X}
        y1={dividerY}
        x2={VIEW_W - PAD_X}
        y2={dividerY}
        stroke="var(--color-border)"
      />

      {txns.map((txn, i) => (
        <Txn
          key={txn.id}
          txn={txn}
          y={txnTop + i * 22}
          nameCol={nameCol}
          justRan={state.active === txn.id}
          ranStatement={state.active === txn.id ? state.ranStatement : undefined}
        />
      ))}

      {(snapshotNote || conflict) && (
        <text
          x={PAD_X}
          y={footer + 10}
          fill={conflict ? "var(--color-glow-red)" : "var(--color-accent)"}
          style={{ font: "600 11px var(--font-plex-mono)" }}
        >
          {conflict ? `⚠ ${conflict}` : `↳ ${snapshotNote}`}
        </text>
      )}
    </svg>
  );
}

const STAMP = {
  font: "500 10px var(--font-plex-mono)",
  letterSpacing: "0.14em",
} as const;
const BODY = { font: "500 11px var(--font-plex-mono)" } as const;
const TINY = { font: "500 9px var(--font-plex-mono)", letterSpacing: "0.1em" } as const;

/**
 * One version of a row. Committed versions are solid green facts stamped with
 * their commit time; an uncommitted one is hollow and dashed because it is not
 * yet a fact; an aborted one is red, the same wound the WAL view draws for a
 * lost record. The version a reader chose this frame is ringed in amber.
 */
function VersionChip({ version: v, x }: { version: VersionFrame; x: number }) {
  const stroke = v.aborted
    ? "var(--color-glow-red)"
    : v.readNow
      ? "var(--color-accent)"
      : v.active
        ? "var(--color-accent)"
        : v.committed
          ? "var(--color-glow-green)"
          : "var(--color-glow-orange)";
  const valueFill = v.aborted
    ? "var(--color-glow-red)"
    : v.committed
      ? "var(--color-glow-green)"
      : "var(--color-glow-orange)";

  return (
    <g transform={`translate(${x}, 0)`}>
      <rect
        width={CHIP_W}
        height={CHIP_H}
        rx={2}
        fill={v.committed && !v.aborted ? "var(--color-raised)" : "transparent"}
        stroke={stroke}
        strokeWidth={v.readNow ? 2 : 1}
        strokeDasharray={v.committed || v.aborted ? undefined : "3 2"}
      />
      {/* The value on the left, its provenance stacked on the right — the two
          never overlap because the chip is sized wider than both together. */}
      <text x={8} y={15} fill={valueFill} style={{ font: "600 12px var(--font-plex-mono)" }}>
        {v.row}={v.value}
      </text>
      <text x={8} y={28} fill="var(--color-fg-faint)" style={TINY}>
        {v.createdBy === "init" ? "base" : v.createdBy}
      </text>
      <text x={CHIP_W - 8} y={28} textAnchor="end" fill="var(--color-fg-faint)" style={TINY}>
        {v.aborted
          ? "rolled back"
          : v.committed
            ? `@ ${v.commitTs}`
            : "pending"}
      </text>
    </g>
  );
}

function Txn({
  txn,
  y,
  nameCol,
  justRan,
  ranStatement,
}: {
  txn: MvccTxnFrame;
  y: number;
  /** Width reserved for the transaction name, shared across rows. */
  nameCol: number;
  justRan: boolean;
  ranStatement?: string;
}) {
  const colour =
    txn.status === "aborted"
      ? "var(--color-glow-red)"
      : txn.status === "committed"
        ? "var(--color-glow-green)"
        : justRan
          ? "var(--color-accent)"
          : "var(--color-fg-muted)";
  const seen = Object.entries(txn.seen);

  return (
    <g transform={`translate(${PAD_X}, ${y})`}>
      <text x={0} y={14} fill={colour} style={{ font: "500 12px var(--font-plex-mono)" }}>
        {txn.name}
      </text>
      <text
        x={nameCol}
        y={14}
        fill={txn.startTs !== undefined ? "var(--color-fg-muted)" : "var(--color-fg-faint)"}
        style={TINY}
      >
        {txn.startTs !== undefined ? `snapshot @ ${txn.startTs}` : "not started"}
      </text>
      <text
        x={nameCol + STATUS_COL - SNAP_COL}
        y={14}
        fill={justRan ? "var(--color-fg)" : "var(--color-fg-faint)"}
        style={{ font: "500 11px var(--font-plex-mono)" }}
      >
        {justRan && ranStatement
          ? ranStatement
          : txn.status !== "active" && txn.status !== "idle"
            ? txn.status
            : txn.next
              ? `next: ${txn.next}`
              : ""}
      </text>
      {seen.length > 0 && (
        <text
          x={VIEW_W - PAD_X * 2}
          y={14}
          textAnchor="end"
          fill="var(--color-fg-faint)"
          style={TINY}
        >
          read {seen.map(([k, val]) => `${k}=${val}`).join("  ")}
        </text>
      )}
    </g>
  );
}

/** One sentence a screen reader can act on, rebuilt per frame. */
function ariaLabel(state: VersionsState): string {
  const parts: string[] = [`Snapshot isolation, logical clock at ${state.clock}.`];
  for (const row of state.rows) {
    const chain = row.versions
      .map((v) =>
        v.aborted
          ? `${v.value} rolled back`
          : v.committed
            ? `${v.value} committed at ${v.commitTs}`
            : `${v.value} uncommitted`,
      )
      .join(", then ");
    parts.push(`${row.key}: ${chain}.`);
  }
  for (const txn of state.txns) {
    if (txn.startTs !== undefined) {
      parts.push(`${txn.name} reads at snapshot ${txn.startTs}, status ${txn.status}.`);
    }
  }
  if (state.snapshotNote) parts.push(state.snapshotNote + ".");
  if (state.conflict) parts.push("Conflict: " + state.conflict + ".");
  return parts.join(" ");
}
