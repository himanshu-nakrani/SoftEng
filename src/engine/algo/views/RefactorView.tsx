"use client";

import type { RefactorFn, RefactorLine, RefactorState } from "./refactor";

const VIEW_W = 800;
const PAD_X = 16;
/** Mono advance at 11px — enough to size a code column from its content. */
const CH = 6.6;
const LINE_H = 15;
const HEADER_H = 22;
const CARD_GAP = 12;
const CARD_PAD = 8;
const COL_GAP = 16;

/**
 * The refactor-workbench stage: each function drawn as a small code card with
 * its two metrics stamped on its header, and the module-level metrics on a
 * hairline strip below. Cards flow left to right and WRAP (the WalView lesson:
 * a strip that does not wrap slides its last item under the stage edge).
 *
 * The one thing this view exists to make visible is that a metric MOVES as a
 * consequence of a structural change — so a card that the current transform
 * touched is ringed amber, a card that did not exist before is dashed until it
 * settles, and the module strip carries the numbers that fall. Decision-point
 * lines (branches, loops, boolean operators, switch arms) are tinted so a reader
 * can SEE where the complexity a card carries comes from, and count it against
 * the header number.
 *
 * Grammar shared with the other archetype-B views: amber = the thing this step
 * touched · dashed = not yet settled (here, a freshly extracted function) ·
 * green = a metric that improved · the figure's own PlateLabel owns the top-
 * right corner, so nothing is drawn there.
 */
export function RefactorView({ state }: { state: RefactorState }) {
  const { fns, metrics, note, transform } = state;

  // Size every card to the widest line across ALL functions, once, so a marker
  // or a ring drawn at a card's right edge never lands in a neighbour's slot
  // (the WalView per-chip-vs-column-pitch bug, avoided by a shared width).
  const widestLine = Math.max(
    ...fns.flatMap((fn) => [fn.name.length + 10, ...fn.lines.map((l) => l.depth * 2 + l.text.length)]),
    16,
  );
  const cardW = Math.min(Math.round(widestLine * CH) + CARD_PAD * 2, 250);
  const perRow = Math.max(1, Math.floor((VIEW_W - PAD_X * 2 + COL_GAP) / (cardW + COL_GAP)));

  // Lay the cards out in a grid, tracking the tallest card per row so the next
  // row clears it.
  const positions: { fn: RefactorFn; x: number; y: number; h: number }[] = [];
  let cursorY = 30;
  for (let i = 0; i < fns.length; ) {
    const row = fns.slice(i, i + perRow);
    const rowH = Math.max(...row.map((fn) => HEADER_H + fn.lines.length * LINE_H + CARD_PAD));
    row.forEach((fn, j) => {
      positions.push({
        fn,
        x: PAD_X + j * (cardW + COL_GAP),
        y: cursorY,
        h: rowH,
      });
    });
    cursorY += rowH + CARD_GAP;
    i += perRow;
  }

  const stripY = cursorY + 2;
  const height = stripY + 40 + (note ? 16 : 0);

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${height}`}
      className="block h-auto w-full"
      role="img"
      aria-label={ariaLabel(state)}
    >
      {/* Left only: the figure's own PlateLabel owns the top-right corner. */}
      <text x={PAD_X} y={16} fill="var(--color-fg-faint)" style={STAMP}>
        REFACTOR · METRICS FROM THE AST
      </text>
      {/* The active transform, anchored mid-stage clear of the PlateLabel. */}
      {transform && (
        <text x={VIEW_W / 2} y={16} textAnchor="middle" fill="var(--color-accent)" style={STAMP}>
          {transform.toUpperCase()}
        </text>
      )}

      {positions.map(({ fn, x, y, h }) => (
        <FnCard key={fn.name} fn={fn} x={x} y={y} w={cardW} h={h} />
      ))}

      {/* hairline between the code and the module metrics it produces */}
      <line x1={PAD_X} y1={stripY} x2={VIEW_W - PAD_X} y2={stripY} stroke="var(--color-border)" />

      <MetricStrip metrics={metrics} y={stripY + 20} />

      {note && (
        <text
          x={PAD_X}
          y={stripY + 38}
          fill="var(--color-fg-muted)"
          style={{ font: "500 11px var(--font-plex-mono)" }}
        >
          {note}
        </text>
      )}
    </svg>
  );
}

const STAMP = { font: "500 10px var(--font-plex-mono)", letterSpacing: "0.14em" } as const;
const TINY = { font: "500 9px var(--font-plex-mono)", letterSpacing: "0.08em" } as const;

/** One function as a code card: name + metrics header, then its lines. */
function FnCard({ fn, x, y, w, h }: { fn: RefactorFn; x: number; y: number; w: number; h: number }) {
  const ring = fn.changed ? "var(--color-accent)" : "var(--color-border)";
  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect
        width={w}
        height={h}
        rx={2}
        fill="var(--color-raised)"
        stroke={ring}
        strokeWidth={fn.changed ? 2 : 1}
        strokeDasharray={fn.isNew ? "4 2" : undefined}
      />
      {/* header: function name on the left, its two metrics on the right */}
      <text x={CARD_PAD} y={15} fill="var(--color-fg)" style={{ font: "600 11px var(--font-plex-mono)" }}>
        {fn.name}()
      </text>
      <text
        x={w - CARD_PAD}
        y={15}
        textAnchor="end"
        fill={fn.complexity >= 6 ? "var(--color-glow-orange)" : "var(--color-fg-faint)"}
        style={TINY}
      >
        cc {fn.complexity} · fan {fn.fanOut}
      </text>
      <line x1={0} y1={HEADER_H} x2={w} y2={HEADER_H} stroke="var(--color-border)" />
      {fn.lines.map((line, i) => (
        <CodeLine key={i} line={line} y={HEADER_H + 4 + i * LINE_H + 9} />
      ))}
    </g>
  );
}

/** One source line, tinted by whether it is a decision point or a call. */
function CodeLine({ line, y }: { line: RefactorLine; y: number }) {
  const decision =
    line.kind === "branch" ||
    line.kind === "loop" ||
    line.kind === "and" ||
    line.kind === "or" ||
    line.kind === "case";
  const fill = line.touched
    ? "var(--color-accent)"
    : decision
      ? "var(--color-glow-orange)"
      : line.kind === "call"
        ? "var(--color-glow-green)"
        : "var(--color-fg-muted)";
  return (
    <text
      x={CARD_PAD + line.depth * 10}
      y={y}
      fill={fill}
      style={{ font: "500 11px var(--font-plex-mono)" }}
    >
      {line.text}
    </text>
  );
}

/** The module-level metrics that fall as the code is restructured. */
function MetricStrip({ metrics, y }: { metrics: RefactorState["metrics"]; y: number }) {
  const items: { label: string; value: number; danger?: boolean }[] = [
    { label: "max complexity", value: metrics.maxComplexity, danger: metrics.maxComplexity >= 6 },
    { label: "decision points", value: metrics.totalDecisions },
    { label: "max fan-out", value: metrics.maxFanOut },
    { label: "duplication", value: metrics.duplication, danger: metrics.duplication > 0 },
  ];
  return (
    <g>
      {items.map((item, i) => {
        const x = PAD_X + i * 190;
        return (
          <g key={item.label} transform={`translate(${x}, ${y})`}>
            <text fill="var(--color-fg-faint)" style={TINY}>
              {item.label.toUpperCase()}
            </text>
            <text
              x={0}
              y={-16}
              fill={item.danger ? "var(--color-glow-orange)" : "var(--color-fg)"}
              style={{ font: "600 18px var(--font-plex-mono)" }}
            >
              {item.value}
            </text>
          </g>
        );
      })}
    </g>
  );
}

/** One sentence a screen reader can act on, rebuilt per frame. */
function ariaLabel(state: RefactorState): string {
  const parts: string[] = [];
  if (state.transform) parts.push(`${state.transform}.`);
  parts.push(
    `Module: max complexity ${state.metrics.maxComplexity}, ${state.metrics.totalDecisions} decision points, max fan-out ${state.metrics.maxFanOut}.`,
  );
  for (const fn of state.fns) {
    parts.push(`${fn.name}: complexity ${fn.complexity}, fan-out ${fn.fanOut}${fn.isNew ? ", new" : ""}.`);
  }
  if (state.note) parts.push(state.note + ".");
  return parts.join(" ");
}
