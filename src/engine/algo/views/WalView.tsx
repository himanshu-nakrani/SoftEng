"use client";

import type { LogRecordFrame, PageFrame, WalState } from "./wal";

const VIEW_W = 800;
const PAD_X = 16;
const LABEL_COL = 84;
const ROW_H = 24;
const ROW_GAP = 10;
const BAND_GAP = 16;
/** Vertical gap between wrapped rows of the log strip. */
const LOG_ROW_GAP = 4;
/** Approximate mono advance at 11px — enough to size a chip from its content. */
const CH = 6.7;
const CHIP_PAD = 14;
const CHIP_GAP = 7;

/**
 * The durability stage: volatile state above a hairline, durable state below it.
 *
 * Everything this view does serves one question — if the power failed on this
 * frame, what would come back? So the composition is not a table but a DIVIDE,
 * and the log is deliberately drawn twice: its forced prefix below the line with
 * the disk pages, its unforced tail above with the buffer pool. Seeing the same
 * log split across the line is the insight the lesson is built on, and it is the
 * one thing `TableView` structurally cannot show.
 *
 * Grammar shared with the transaction views, so a reader carries it across:
 * dashed and hollow = not settled (here: not durable) · solid green = durable
 * fact · amber = the thing this step touched · red = a wound.
 */
export function WalView({ state }: { state: WalState }) {
  const { pages, log, flushedUpTo, txns, policy, phase, logged, violation, verdict } = state;

  const forced = log.filter((r) => r.lsn <= flushedUpTo);
  const tail = log.filter((r) => r.lsn > flushedUpTo);
  const poolGone = pages.every((p) => p.buffered === undefined);

  // Measured once from the whole set, then shared: both page rows use the same
  // ladder, and both log rows use the same pitch as each other so the forced
  // prefix and the volatile tail read as one strip split by the line.
  const colW = pageChipW(pages);
  const pageAt = (i: number) => PAD_X + LABEL_COL + i * (colW + CHIP_GAP);
  const logW = log.length > 0 ? logChipW(log) : 0;

  /*
   * The log strip WRAPS. A single row held six records and silently slid the
   * seventh under the stage edge — the same failure as the code panel's 27-char
   * limit, and invisible for the same reason: the author never sees it, because
   * the script is written in a `.ts` file. Wrapping removes the constraint
   * instead of requiring a check to police it, so a script may be any length.
   */
  const stripW = VIEW_W - PAD_X * 2 - LABEL_COL;
  const perRow = Math.max(1, Math.floor((stripW + CHIP_GAP) / (logW + CHIP_GAP)));
  const logAt = (i: number) => ({
    x: PAD_X + LABEL_COL + (i % perRow) * (logW + CHIP_GAP),
    dy: Math.floor(i / perRow) * (ROW_H + LOG_ROW_GAP),
  });
  /** Height of a log band holding `n` records, at least one row tall. */
  const bandH = (n: number) => {
    const rows = Math.max(1, Math.ceil(n / perRow));
    return rows * ROW_H + (rows - 1) * LOG_ROW_GAP;
  };

  // Lay the bands out top to bottom with a cursor, so a script with no log or a
  // single page does not leave a hole where a row would have been.
  let y = 38;
  const volatileLabel = y;
  y += 14;
  const poolRow = y;
  y += ROW_H + ROW_GAP;
  const tailRow = y;
  y += bandH(tail.length) + BAND_GAP;
  const divide = y;
  y += BAND_GAP + 6;
  const durableLabel = y;
  y += 14;
  const forcedRow = y;
  y += bandH(forced.length) + ROW_GAP;
  const diskRow = y;
  y += ROW_H + BAND_GAP;
  const txnTop = y;
  y += txns.length * 18 + 6;
  const footer = y;
  const height = footer + (violation || verdict ? 16 : 0);

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${height}`}
      className="block h-auto w-full"
      role="img"
      aria-label={ariaLabel(state)}
    >
      {/* Left only: the figure's own PlateLabel owns the top-right corner, and
          anything placed there collides with it. */}
      <text x={PAD_X} y={16} fill="var(--color-fg-faint)" style={STAMP}>
        WAL · {policy.toUpperCase()}
      </text>

      {/* ---- volatile ---- */}
      <text x={PAD_X} y={volatileLabel} fill="var(--color-fg-faint)" style={TINY}>
        VOLATILE — lost when the power fails
      </text>


      <RowLabel y={poolRow} text="buffer pool" />
      {poolGone ? (
        <text x={PAD_X + LABEL_COL} y={poolRow + 16} fill="var(--color-glow-red)" style={BODY}>
          gone
        </text>
      ) : (
        pages.map((page, i) => (
          <PageChip key={page.id} page={page} x={pageAt(i)} y={poolRow} w={colW} volatile />
        ))
      )}

      <RowLabel y={tailRow} text="log tail" />
      {tail.length === 0 ? (
        <text x={PAD_X + LABEL_COL} y={tailRow + 16} fill="var(--color-fg-faint)" style={BODY}>
          {!logged ? "no log is kept" : "nothing unforced"}
        </text>
      ) : (
        tail.map((r, i) => (
          <LogChip
            key={r.lsn}
            record={r}
            x={logAt(i).x}
            y={tailRow + logAt(i).dy}
            w={logW}
          />
        ))
      )}

      {/* ---- the line everything is about ---- */}
      <line
        x1={PAD_X}
        y1={divide}
        x2={VIEW_W - PAD_X}
        y2={divide}
        stroke="var(--color-accent)"
        strokeOpacity={0.55}
      />
      {/* The phase belongs to the divide — it says which side of the line the
          run is currently living on. Kept well clear of the top-right corner,
          which the figure's PlateLabel owns. */}
      <text
        x={VIEW_W - PAD_X}
        y={divide - 6}
        textAnchor="end"
        fill={
          phase === "crash"
            ? "var(--color-glow-red)"
            : phase === "run"
              ? "var(--color-fg-faint)"
              : "var(--color-accent)"
        }
        style={STAMP}
      >
        {PHASE_LABEL[phase]}
      </text>
      <text x={PAD_X} y={durableLabel} fill="var(--color-fg-faint)" style={TINY}>
        DURABLE — survives the power failure
      </text>

      <RowLabel y={forcedRow} text="forced log" />
      {forced.length === 0 ? (
        <text x={PAD_X + LABEL_COL} y={forcedRow + 16} fill="var(--color-fg-faint)" style={BODY}>
          {!logged ? "—" : "nothing forced yet"}
        </text>
      ) : (
        forced.map((r, i) => (
          <LogChip
            key={r.lsn}
            record={r}
            x={logAt(i).x}
            y={forcedRow + logAt(i).dy}
            w={logW}
          />
        ))
      )}

      <RowLabel y={diskRow} text="disk pages" />
      {pages.map((page, i) => (
        <PageChip key={page.id} page={page} x={pageAt(i)} y={diskRow} w={colW} />
      ))}

      {/* ---- transactions ---- */}
      {txns.map((txn, i) => (
        <g key={txn.id} transform={`translate(${PAD_X}, ${txnTop + i * 18})`}>
          <text y={12} fill={txnColour(txn.status)} style={BODY}>
            {txn.name}
          </text>
          <text x={190} y={12} fill="var(--color-fg-faint)" style={BODY}>
            {txn.status}
            {txn.acknowledged ? " · reported success" : ""}
          </text>
        </g>
      ))}

      {/* A STAMP, not a sentence. The step caption below the stage already
          carries the verdict in prose, and printing both put the same words on
          screen twice. What the stage adds is the glanceable answer, plus the
          violation — which is different information, not a restatement. */}
      {(violation || verdict) && (
        <text
          x={PAD_X}
          y={footer + 10}
          fill={state.lostCommit || violation ? "var(--color-glow-red)" : "var(--color-glow-green)"}
          style={{ font: "600 11px var(--font-plex-mono)", letterSpacing: "0.1em" }}
        >
          {violation
            ? `⚠ ${violation}`
            : state.lostCommit
              ? "⚠ DURABILITY BROKEN"
              : state.acknowledged === 0
                ? "✓ NOTHING WAS PROMISED — no commit had been reported yet"
                : "✓ DURABLE — every acknowledged commit came back"}
        </text>
      )}
    </svg>
  );
}

const STAMP = {
  font: "500 10px var(--font-plex-mono)",
  letterSpacing: "0.14em",
} as const;
const TINY = { font: "500 9px var(--font-plex-mono)", letterSpacing: "0.12em" } as const;
const BODY = { font: "500 11px var(--font-plex-mono)" } as const;

const PHASE_LABEL: Record<WalState["phase"], string> = {
  run: "RUNNING",
  crash: "POWER LOST",
  recover: "RECOVERING",
  done: "RESTARTED",
};

function RowLabel({ y, text }: { y: number; text: string }) {
  return (
    <text x={PAD_X} y={y + 16} fill="var(--color-fg-muted)" style={BODY}>
      {text}
    </text>
  );
}

/**
 * One column width for every page chip, so the buffer-pool copy and the disk
 * copy line up vertically and no chip's contents can reach into the next slot.
 *
 * Sized for the widest label INCLUDING the dirty marker: the marker used to be
 * drawn just outside a chip sized to its own content, which was invisible until
 * two pages were dirty at once and the first one's marker landed on the second.
 */
function pageChipW(pages: PageFrame[]): number {
  const widest = Math.max(...pages.map((p) => `${p.id} 0000  DIRTY`.length), 14);
  return Math.round(widest * CH + CHIP_PAD);
}

function PageChip({
  page,
  x,
  y,
  w,
  volatile: isVolatile,
}: {
  page: PageFrame;
  x: number;
  y: number;
  /** Shared column width — never derived from this chip's own content. */
  w: number;
  volatile?: boolean;
}) {
  const value = isVolatile ? page.buffered : page.disk;
  // Dirty means the two copies disagree, which is the state the whole design
  // permits — so it is marked on the volatile copy, where the risk sits.
  const unsettled = isVolatile && page.dirty;
  const stroke = page.active
    ? "var(--color-accent)"
    : unsettled
      ? "var(--color-glow-orange)"
      : isVolatile
        ? "var(--color-border)"
        : page.repaired
          ? "var(--color-accent)"
          : "var(--color-border)";
  const fill = isVolatile
    ? unsettled
      ? "var(--color-glow-orange)"
      : "var(--color-fg-muted)"
    : "var(--color-glow-green)";

  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect
        width={w}
        height={ROW_H}
        rx={2}
        fill={isVolatile ? "transparent" : "var(--color-raised)"}
        stroke={stroke}
        strokeDasharray={unsettled ? "3 2" : undefined}
      />
      <text x={8} y={16} fill={fill} style={BODY}>
        {page.id} {value ?? "—"}
      </text>
      {/* Inside the chip, right-aligned: it belongs to this page, and outside it
          would sit in the next page's column. */}
      {unsettled && (
        <text
          x={w - 7}
          y={16}
          textAnchor="end"
          fill="var(--color-glow-orange)"
          style={TINY}
        >
          DIRTY
        </text>
      )}
    </g>
  );
}

function recordText(r: LogRecordFrame): string {
  if (r.kind === "commit") return `COMMIT ${r.txn ?? ""}`.trim();
  if (r.kind === "abort") return `ABORT ${r.txn ?? ""}`.trim();
  if (r.kind === "checkpoint") return "CHECKPOINT";
  return `${r.page} ${r.before}→${r.after}`;
}
/** As with pages: one width for the whole strip, so pitch and rect agree. */
function logChipW(records: LogRecordFrame[]): number {
  const widest = Math.max(...records.map((r) => recordText(r).length), 8);
  return Math.round(widest * CH + CHIP_PAD + 12);
}

function LogChip({
  record,
  x,
  y,
  w,
}: {
  record: LogRecordFrame;
  x: number;
  y: number;
  w: number;
}) {
  const colour = record.lost
    ? "var(--color-glow-red)"
    : record.undone
      ? "var(--color-glow-red)"
      : record.redone
        ? "var(--color-accent)"
        : record.active
          ? "var(--color-accent)"
          : record.durable
            ? "var(--color-glow-green)"
            : "var(--color-glow-orange)";

  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect
        width={w}
        height={ROW_H}
        rx={2}
        fill={record.durable ? "var(--color-raised)" : "transparent"}
        stroke={colour}
        strokeDasharray={record.durable ? undefined : "3 2"}
      />
      <text x={7} y={16} fill="var(--color-fg-faint)" style={TINY}>
        {record.lsn}
      </text>
      <text x={19} y={16} fill={colour} style={BODY}>
        {recordText(record)}
      </text>
    </g>
  );
}

function txnColour(status: WalState["txns"][number]["status"]): string {
  if (status === "committed") return "var(--color-glow-green)";
  if (status === "lost") return "var(--color-glow-red)";
  // Waiting for a force is the same kind of unsettled as a dirty page, so it
  // takes the same hue rather than inventing one.
  if (status === "aborted" || status === "committing") return "var(--color-glow-orange)";
  return "var(--color-fg-muted)";
}

/** One sentence a screen reader can act on, rebuilt per frame. */
function ariaLabel(state: WalState): string {
  const parts: string[] = [`${PHASE_LABEL[state.phase]}, ${state.policy}.`];

  const pool = state.pages.every((p) => p.buffered === undefined)
    ? "The buffer pool is gone."
    : `Buffer pool: ${state.pages
        .map((p) => `${p.id} is ${p.buffered}${p.dirty ? " and dirty" : ""}`)
        .join(", ")}.`;
  parts.push(pool);
  parts.push(`On disk: ${state.pages.map((p) => `${p.id} is ${p.disk}`).join(", ")}.`);

  const forced = state.log.filter((r) => r.lsn <= state.flushedUpTo).length;
  const tail = state.log.length - forced;
  parts.push(
    state.log.length === 0
      ? "There is no log."
      : `Log: ${forced} record${forced === 1 ? "" : "s"} forced to disk, ${tail} still volatile.`,
  );

  if (state.violation) parts.push(`Violation: ${state.violation}.`);
  if (state.verdict) parts.push(state.verdict);
  return parts.join(" ");
}
