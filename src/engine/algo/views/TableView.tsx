"use client";

import type {
  PackageTableState,
  RowFrame,
  TableState,
  TableViewState,
  TxnFrame,
} from "./table";
import { isPackageTableState } from "./table";

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
 * Universal table view:
 * 1. Package metrics view (Archetype B for modularity): Instability (I), Abstractness (A), Distance (D)
 * 2. Multi-column table view (Archetype B for modularity): Afferent (Ca) & Efferent (Ce) coupling
 * 3. Transaction stage (Archetype B for transactions): committed table on top, uncommitted below.
 */
export function TableView({ state }: { state: TableViewState }) {
  if (isPackageTableState(state)) {
    return <PackageMetricsView state={state} />;
  }
  if ("columns" in state && state.columns && state.columns.length > 0) {
    return <MultiColumnTableView state={state} />;
  }
  return <TransactionTableView state={state} />;
}

function MultiColumnTableView({ state }: { state: TableState<number | string> }) {
  const { rows, columns = [], active, isolation, anomaly, ranStatement } = state;
  const colCount = columns.length;
  const totalWidth = VIEW_W - PAD_X * 2;
  const colWidths = columns.map((c) => c.width ?? totalWidth / colCount);
  const colOffsets = colWidths.reduce<number[]>((acc, w, i) => {
    acc.push(i === 0 ? PAD_X : acc[i - 1] + colWidths[i - 1]);
    return acc;
  }, []);

  const headerY = 36;
  const headerH = 28;
  const rowStartY = headerY + headerH + 8;
  const rowH = 34;
  const tableBottom = rowStartY + rows.length * rowH;
  const statementY = tableBottom + 16;
  const anomalyY = ranStatement ? statementY + 22 : statementY;
  const height = anomaly ? anomalyY + 24 : ranStatement ? statementY + 24 : tableBottom + 16;

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${height}`}
      className="block h-auto w-full"
      role="img"
      aria-label={multiColumnAriaLabel(state)}
    >
      <text
        x={PAD_X}
        y={18}
        fill="var(--color-fg-faint)"
        style={{ font: "500 10px var(--font-plex-mono)", letterSpacing: "0.14em" }}
      >
        {isolation.toUpperCase()}
      </text>

      <rect
        x={PAD_X}
        y={headerY}
        width={totalWidth}
        height={headerH}
        rx={3}
        fill="var(--color-raised)"
        stroke="var(--color-border)"
      />
      {columns.map((col, i) => (
        <text
          key={col.key}
          x={colOffsets[i] + 12}
          y={headerY + 18}
          fill="var(--color-fg-muted)"
          style={{ font: "600 11px var(--font-plex-mono)" }}
        >
          {col.label}
        </text>
      ))}

      {rows.map((row, i) => {
        const y = rowStartY + i * rowH;
        const isActive = active === row.key;
        return (
          <g key={row.key} transform={`translate(0, ${y})`}>
            <rect
              x={PAD_X}
              y={0}
              width={totalWidth}
              height={rowH - 4}
              rx={3}
              fill={isActive ? "var(--color-raised)" : "transparent"}
              stroke={isActive ? "var(--color-accent)" : "var(--color-border)"}
              strokeWidth={isActive ? 1.5 : 1}
            />
            {columns.map((col, cIdx) => {
              const val = row.values ? row.values[col.key] : (cIdx === 0 ? row.key : row.committed);
              const isFirst = cIdx === 0;
              const isCe = col.key === "ce";
              const isTotal = col.key === "total";
              const color = isActive
                ? "var(--color-accent)"
                : isTotal && Number(val) <= 2
                  ? "var(--color-glow-green)"
                  : isCe && Number(val) > 1
                    ? "var(--color-glow-orange)"
                    : "var(--color-fg)";
              return (
                <text
                  key={col.key}
                  x={colOffsets[cIdx] + 12}
                  y={20}
                  fill={color}
                  style={{ font: isFirst ? "600 12px var(--font-plex-mono)" : "500 12px var(--font-plex-mono)" }}
                >
                  {val !== undefined ? String(val) : "—"}
                </text>
              );
            })}
          </g>
        );
      })}

      {ranStatement && (
        <g transform={`translate(${PAD_X}, ${statementY})`}>
          <text
            x={0}
            y={12}
            fill="var(--color-accent)"
            style={{ font: "500 11px var(--font-plex-mono)" }}
          >
            ▸ {ranStatement}
          </text>
        </g>
      )}

      {anomaly && (
        <text
          x={PAD_X}
          y={anomalyY + 12}
          fill={anomaly.startsWith("⚠") ? "var(--color-glow-red)" : "var(--color-glow-green)"}
          style={{ font: "600 11px var(--font-plex-mono)" }}
        >
          {anomaly}
        </text>
      )}
    </svg>
  );
}

function PackageMetricsView({ state }: { state: PackageTableState }) {
  const { packages, caption, highlightPackage } = state;
  const usableW = VIEW_W - PAD_X * 2;
  const tableTop = 64;
  const rowPitch = 38;
  const sepY = tableTop + packages.length * rowPitch + 8;
  const footerY = sepY + 22;
  const height = footerY + 16;

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${height}`}
      className="block h-auto w-full"
      role="img"
      aria-label={packageAriaLabel(state)}
    >
      <text
        x={PAD_X}
        y={18}
        fill="var(--color-fg-faint)"
        style={{ font: "500 10px var(--font-plex-mono)", letterSpacing: "0.14em" }}
      >
        PACKAGE METRICS · INSTABILITY (I), ABSTRACTNESS (A), DISTANCE (D)
      </text>

      <rect
        x={PAD_X}
        y={28}
        width={usableW}
        height={26}
        rx={2}
        fill="var(--color-raised)"
        stroke="var(--color-border)"
      />
      <text
        x={PAD_X + 12}
        y={45}
        fill="var(--color-fg-muted)"
        style={{ font: "600 10px var(--font-plex-mono)", letterSpacing: "0.08em" }}
      >
        PACKAGE
      </text>
      <text
        x={165}
        y={45}
        fill="var(--color-fg-muted)"
        style={{ font: "600 10px var(--font-plex-mono)", letterSpacing: "0.08em" }}
      >
        Ca
      </text>
      <text
        x={225}
        y={45}
        fill="var(--color-fg-muted)"
        style={{ font: "600 10px var(--font-plex-mono)", letterSpacing: "0.08em" }}
      >
        Ce
      </text>
      <text
        x={290}
        y={45}
        fill="var(--color-fg-muted)"
        style={{ font: "600 10px var(--font-plex-mono)", letterSpacing: "0.08em" }}
      >
        INSTABILITY I
      </text>
      <text
        x={430}
        y={45}
        fill="var(--color-fg-muted)"
        style={{ font: "600 10px var(--font-plex-mono)", letterSpacing: "0.08em" }}
      >
        ABSTRACTNESS A
      </text>
      <text
        x={560}
        y={45}
        fill="var(--color-fg-muted)"
        style={{ font: "600 10px var(--font-plex-mono)", letterSpacing: "0.08em" }}
      >
        DISTANCE D
      </text>
      <text
        x={680}
        y={45}
        fill="var(--color-fg-muted)"
        style={{ font: "600 10px var(--font-plex-mono)", letterSpacing: "0.08em" }}
      >
        ZONE
      </text>

      {packages.map((pkg, idx) => {
        const isHighlight =
          pkg.highlight || (highlightPackage && pkg.name === highlightPackage);
        const y = tableTop + idx * rowPitch;
        const dColour =
          pkg.d === 0
            ? "var(--color-glow-green)"
            : pkg.d >= 0.8
              ? "var(--color-glow-red)"
              : "var(--color-glow-orange)";

        const zone = pkg.zone ?? (pkg.d === 0 ? "Main Sequence" : pkg.d >= 0.8 ? "Zone of Pain" : "Transition");
        const zoneBadgeColour =
          zone === "Zone of Pain"
            ? "var(--color-glow-red)"
            : zone === "Zone of Uselessness"
              ? "var(--color-glow-orange)"
              : zone === "Main Sequence"
                ? "var(--color-glow-green)"
                : "var(--color-accent)";

        const zoneBg =
          zone === "Zone of Pain"
            ? "rgba(239, 68, 68, 0.12)"
            : zone === "Zone of Uselessness"
              ? "rgba(249, 115, 22, 0.12)"
              : zone === "Main Sequence"
                ? "rgba(34, 197, 94, 0.12)"
                : "rgba(245, 158, 11, 0.12)";

        return (
          <g key={pkg.name}>
            <rect
              x={PAD_X}
              y={y}
              width={usableW}
              height={32}
              rx={3}
              fill={isHighlight ? "rgba(245, 158, 11, 0.08)" : "var(--color-raised)"}
              stroke={isHighlight ? "var(--color-accent)" : "var(--color-border)"}
              strokeWidth={isHighlight ? 1.5 : 1}
            />
            <text
              x={PAD_X + 12}
              y={y + 20}
              fill={isHighlight ? "var(--color-accent)" : "var(--color-fg)"}
              style={{ font: "600 12px var(--font-plex-mono)" }}
            >
              {pkg.name}
            </text>
            <text
              x={165}
              y={y + 20}
              fill="var(--color-fg-muted)"
              style={{ font: "500 12px var(--font-plex-mono)" }}
            >
              {pkg.ca}
            </text>
            <text
              x={225}
              y={y + 20}
              fill="var(--color-fg-muted)"
              style={{ font: "500 12px var(--font-plex-mono)" }}
            >
              {pkg.ce}
            </text>
            <text
              x={290}
              y={y + 20}
              fill={
                pkg.i === 0
                  ? "var(--color-glow-blue, #38bdf8)"
                  : pkg.i === 1
                    ? "var(--color-glow-orange)"
                    : "var(--color-fg)"
              }
              style={{ font: "600 12px var(--font-plex-mono)" }}
            >
              {pkg.i.toFixed(2)}
            </text>
            <text
              x={430}
              y={y + 20}
              fill={pkg.a > 0 ? "var(--color-glow-green)" : "var(--color-fg-muted)"}
              style={{ font: "600 12px var(--font-plex-mono)" }}
            >
              {pkg.a.toFixed(2)}
            </text>
            <text
              x={560}
              y={y + 20}
              fill={dColour}
              style={{ font: "700 12px var(--font-plex-mono)" }}
            >
              {pkg.d.toFixed(2)}
            </text>
            <rect
              x={672}
              y={y + 6}
              width={100}
              height={20}
              rx={2}
              fill={zoneBg}
              stroke={zoneBadgeColour}
              strokeWidth={1}
            />
            <text
              x={722}
              y={y + 20}
              textAnchor="middle"
              fill={zoneBadgeColour}
              style={{ font: "600 10px var(--font-plex-mono)" }}
            >
              {zone}
            </text>
          </g>
        );
      })}

      <line
        x1={PAD_X}
        y1={sepY}
        x2={VIEW_W - PAD_X}
        y2={sepY}
        stroke="var(--color-border)"
      />

      {caption && (
        <text
          x={PAD_X}
          y={footerY}
          fill="var(--color-accent)"
          style={{ font: "500 11px var(--font-plex-mono)" }}
        >
          {caption}
        </text>
      )}
    </svg>
  );
}

function packageAriaLabel(state: PackageTableState): string {
  const pkgs = state.packages
    .map(
      (p) =>
        `${p.name}: Ca=${p.ca}, Ce=${p.ce}, I=${p.i.toFixed(2)}, A=${p.a.toFixed(2)}, D=${p.d.toFixed(2)}${p.zone ? ` (${p.zone})` : ""}`,
    )
    .join("; ");
  return `Package metrics table. ${pkgs}. ${state.caption ?? ""}`;
}

function multiColumnAriaLabel(state: TableState<number | string>): string {
  const pkgs = state.rows
    .map((r) => {
      const ca = r.values?.ca ?? 0;
      const ce = r.values?.ce ?? 0;
      const total = r.values?.total ?? r.committed;
      return `${r.key}: Ca ${ca}, Ce ${ce}, Total ${total}`;
    })
    .join("; ");
  return `Coupling Metrics Table: ${pkgs}. ${state.ranStatement ?? ""}`;
}

function TransactionTableView({ state }: { state: TableState<number | string> }) {
  const { rows, txns, active, isolation, anomaly } = state;
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
      aria-label={transactionAriaLabel(state)}
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
  row: RowFrame<number | string>;
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
  txn: TxnFrame<number | string>;
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

function transactionAriaLabel(state: TableState<number | string>): string {
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
