"use client";

import type { RowFrame, TableState, TxnFrame } from "./table";

const VIEW_W = 800;
const PAD_X = 16;
const ROW_H = 34;
const TXN_H = 46;
const HEADER = 24;
/**
 * Approximate advance of the mono face at the sizes used here. Enough to size a
 * column from its content, which a fixed offset cannot do: a hardcoded 112px fit
 * "T1 · alice" and then collided with "T2 · withdraw 30", rendering it as
 * "T2 · withdraw 30committed".
 */
const CH = 7.2;
const LABEL_GAP = 14;

/**
 * The transaction stage: the table's committed state on top, each transaction's
 * own view of the world below.
 *
 * The one thing this view exists to make visible is the gap between `committed`
 * and `pending`. A pending write is drawn attached to its row but hollow, so an
 * uncommitted value never looks like a fact — and when a transaction reads one,
 * the anomaly banner names it rather than leaving the reader to infer it.
 *
 * Colour: amber = the transaction that just acted · green = committed ·
 * red = aborted, or a read of something that was never committed.
 */
export function TableView({ state }: { state: TableState }) {
  const { rows, txns, active, isolation, anomaly } = state;
  // One column offset shared by the table and the transactions, so they stay
  // aligned, wide enough for whichever label is longest.
  const widest = Math.max(
    ...rows.map((row) => row.key.length),
    ...txns.map((txn) => txn.name.length),
    12,
  );
  const labelCol = Math.round(widest * CH + LABEL_GAP);
  const tableTop = HEADER + 18;
  const txnTop = tableTop + rows.length * ROW_H + 26;
  const height = txnTop + txns.length * TXN_H + 12;
  const colW = Math.min((VIEW_W - PAD_X * 2 - labelCol) / Math.max(rows.length, 1), 150);

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${height}`}
      className="block h-auto w-full"
      role="img"
      aria-label={ariaLabel(state)}
    >
      <text
        x={PAD_X}
        y={16}
        fill="var(--color-fg-faint)"
        style={{ font: "500 10px var(--font-plex-mono)", letterSpacing: "0.14em" }}
      >
        TABLE · {isolation.toUpperCase()}
      </text>

      {rows.map((row, i) => (
        <Row
          key={row.key}
          row={row}
          y={tableTop + i * ROW_H}
          colW={colW}
          labelCol={labelCol}
          active={active}
        />
      ))}

      {/* hairline between the table and the transactions reading it */}
      <line
        x1={PAD_X}
        y1={txnTop - 14}
        x2={VIEW_W - PAD_X}
        y2={txnTop - 14}
        stroke="var(--color-border)"
      />

      {txns.map((txn, i) => (
        <Txn
          key={txn.id}
          txn={txn}
          y={txnTop + i * TXN_H}
          labelCol={labelCol}
          justRan={active === txn.id}
          ranStatement={active === txn.id ? state.ranStatement : undefined}
        />
      ))}

      {anomaly && (
        <text
          x={PAD_X}
          y={height - 2}
          fill="var(--color-glow-red)"
          style={{ font: "600 11px var(--font-plex-mono)" }}
        >
          ⚠ {anomaly}
        </text>
      )}
    </svg>
  );
}

function Row({
  row,
  y,
  colW,
  labelCol,
  active,
}: {
  row: RowFrame;
  y: number;
  colW: number;
  labelCol: number;
  active: string | null;
}) {
  const pending = Object.entries(row.pending);

  return (
    <g transform={`translate(${PAD_X}, ${y})`}>
      <text
        x={0}
        y={16}
        fill="var(--color-fg-muted)"
        style={{ font: "500 11px var(--font-plex-mono)" }}
      >
        {row.key}
      </text>

      {/* committed: the durable fact */}
      <g transform={`translate(${labelCol}, 0)`}>
        <rect
          width={colW}
          height={24}
          rx={2}
          fill="var(--color-raised)"
          stroke="var(--color-border)"
        />
        <text
          x={colW / 2}
          y={16}
          textAnchor="middle"
          fill="var(--color-glow-green)"
          style={{ font: "600 12px var(--font-plex-mono)" }}
        >
          {row.committed}
        </text>
      </g>

      {/* pending: hollow, so it never reads as settled */}
      {pending.map(([txnId, value], i) => (
        <g key={txnId} transform={`translate(${labelCol + colW + 12 + i * (colW + 10)}, 0)`}>
          <rect
            width={colW}
            height={24}
            rx={2}
            fill="transparent"
            stroke={active === txnId ? "var(--color-accent)" : "var(--color-glow-orange)"}
            strokeDasharray="3 2"
          />
          <text
            x={colW / 2}
            y={16}
            textAnchor="middle"
            fill={active === txnId ? "var(--color-accent)" : "var(--color-glow-orange)"}
            style={{ font: "500 11px var(--font-plex-mono)" }}
          >
            {value} · {txnId} uncommitted
          </text>
        </g>
      ))}

      {row.lockedBy && pending.length === 0 && (
        <text
          x={labelCol + colW + 12}
          y={16}
          fill="var(--color-accent)"
          style={{ font: "500 10px var(--font-plex-mono)" }}
        >
          locked by {row.lockedBy}
        </text>
      )}
    </g>
  );
}

function Txn({
  txn,
  y,
  labelCol,
  justRan,
  ranStatement,
}: {
  txn: TxnFrame;
  y: number;
  labelCol: number;
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
          : txn.waitingOn
            ? "var(--color-glow-orange)"
            : "var(--color-fg-muted)";

  const seen = Object.entries(txn.seen);

  return (
    <g transform={`translate(${PAD_X}, ${y})`}>
      <text x={0} y={14} fill={colour} style={{ font: "500 12px var(--font-plex-mono)" }}>
        {txn.name}
      </text>
      <text
        x={labelCol}
        y={14}
        fill={justRan ? "var(--color-fg)" : "var(--color-fg-faint)"}
        style={{ font: "500 11px var(--font-plex-mono)" }}
      >
        {txn.waitingOn
          ? `waiting for ${txn.waitingOn}`
          : justRan && ranStatement
            ? ranStatement
            : txn.status !== "active"
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
          style={{ font: "500 10px var(--font-plex-mono)" }}
        >
          read {seen.map(([k, v]) => `${k}=${v}`).join("  ")}
        </text>
      )}
    </g>
  );
}

/** One sentence a screen reader can act on, rebuilt per frame. */
function ariaLabel(state: TableState): string {
  const committed = state.rows
    .map((row) => `${row.key} is ${row.committed}`)
    .join(", ");
  const pending = state.rows.flatMap((row) =>
    Object.entries(row.pending).map(
      ([txn, value]) => `${txn} has written ${value} to ${row.key} without committing`,
    ),
  );
  const parts = [`Isolation: ${state.isolation}.`, `Committed: ${committed}.`];
  if (pending.length > 0) parts.push(`${pending.join("; ")}.`);
  if (state.anomaly) parts.push(`Anomaly: ${state.anomaly}.`);
  return parts.join(" ");
}
