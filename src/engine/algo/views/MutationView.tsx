"use client";

import type { MutationState, MutantFrame } from "./mutation";

const VIEW_W = 800;
const ROW_H = 26;
/**
 * Deep enough that the rotated test names clear the figure's PlateLabel.
 *
 * The names anchor at `HEADER_H - 8` and rotate -32 degrees, so a long one
 * extends roughly 32 units UP and to the RIGHT — straight into the top-right
 * corner the plate owns. At 58 they overlapped it and were unreadable.
 */
const HEADER_H = 100;
const PAD_X = 16;
const LABEL_W = 300;

/**
 * The mutation grid: one row per mutant, one column per test.
 *
 * The shape carries the lesson. A row that is entirely pale is a survivor — a
 * change to the code that the whole suite sleeps through — and a column that is
 * pale everywhere is a test that has never caught anything.
 *
 * Color language: green = killed (good) · red = survived (a hole) ·
 * amber = executing now.
 */
export function MutationView({ state }: { state: MutationState }) {
  const { mutants, tests, running, baselineGreen } = state;
  const height = HEADER_H + mutants.length * ROW_H + 26;
  const cellW = Math.min((VIEW_W - PAD_X * 2 - LABEL_W) / Math.max(tests.length, 1), 84);

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${height}`}
      className="block h-auto w-full"
      role="img"
      aria-label={ariaLabel(state)}
    >
      {/* baseline verdict — everything below is meaningless without it */}
      <text
        x={PAD_X}
        y={18}
        fill={
          baselineGreen === null
            ? "var(--color-fg-faint)"
            : baselineGreen
              ? "var(--color-glow-green)"
              : "var(--color-glow-red)"
        }
        style={{ font: "500 10px var(--font-plex-mono)", letterSpacing: "0.14em" }}
      >
        {baselineGreen === null
          ? "BASELINE · UNVERIFIED"
          : baselineGreen
            ? "BASELINE · GREEN"
            : "BASELINE · RED — MUTATION SCORE IS MEANINGLESS"}
      </text>

      {/* test column headers, rotated so long names fit */}
      {tests.map((name, c) => (
        <text
          key={name}
          x={PAD_X + LABEL_W + c * cellW + cellW / 2}
          y={HEADER_H - 8}
          textAnchor="start"
          fill={
            running?.testName === name
              ? "var(--color-accent)"
              : "var(--color-fg-faint)"
          }
          transform={`rotate(-32, ${PAD_X + LABEL_W + c * cellW + cellW / 2}, ${HEADER_H - 8})`}
          style={{ font: "500 9px var(--font-plex-mono)" }}
        >
          {name}
        </text>
      ))}

      {mutants.map((mutant, r) => (
        <Row
          key={mutant.id}
          mutant={mutant}
          tests={tests}
          y={HEADER_H + r * ROW_H}
          cellW={cellW}
          running={running}
        />
      ))}

      {/* score */}
      <text
        x={PAD_X}
        y={height - 8}
        fill="var(--color-fg-muted)"
        style={{ font: "500 11px var(--font-plex-mono)" }}
      >
        <tspan fill="var(--color-glow-green)">{state.killed} killed</tspan>
        {"   "}
        <tspan fill="var(--color-glow-red)">{state.survived} survived</tspan>
        {"   "}
        <tspan fill="var(--color-fg-faint)">of {mutants.length}</tspan>
      </text>
    </svg>
  );
}

function Row({
  mutant,
  tests,
  y,
  cellW,
  running,
}: {
  mutant: MutantFrame;
  tests: string[];
  y: number;
  cellW: number;
  running: MutationState["running"];
}) {
  const verdict =
    mutant.status === "killed"
      ? "var(--color-glow-green)"
      : mutant.status === "survived"
        ? "var(--color-glow-red)"
        : mutant.status === "testing"
          ? "var(--color-accent)"
          : "var(--color-border-bright)";

  return (
    <g transform={`translate(${PAD_X}, ${y})`}>
      <text
        x={0}
        y={16}
        fill={
          mutant.status === "pending"
            ? "var(--color-fg-faint)"
            : "var(--color-fg-muted)"
        }
        style={{ font: "500 11px var(--font-plex-mono)" }}
      >
        {mutant.label.length > 44
          ? `${mutant.label.slice(0, 43)}…`
          : mutant.label}
      </text>

      {tests.map((name, c) => {
        const ran = c < mutant.testsRun;
        const isKiller = mutant.killedBy === name;
        const isRunning =
          running?.mutantId === mutant.id && running.testName === name;
        const fill = isRunning
          ? "var(--color-accent)"
          : isKiller
            ? "var(--color-glow-green)"
            : ran
              ? "var(--color-border-bright)"
              : "var(--color-border)";
        return (
          <rect
            key={name}
            x={LABEL_W + c * cellW + 2}
            y={5}
            width={Math.max(cellW - 5, 3)}
            height={14}
            rx={2}
            fill={fill}
            opacity={isRunning || isKiller ? 1 : ran ? 0.55 : 0.28}
            style={{
              transition: "fill 140ms, opacity 140ms",
              filter: isRunning ? `drop-shadow(0 0 5px ${fill})` : undefined,
            }}
          />
        );
      })}

      {/* verdict pip at the right edge */}
      <circle
        cx={VIEW_W - PAD_X * 2 - 4}
        cy={12}
        r={3.5}
        fill={verdict}
        opacity={mutant.status === "pending" ? 0.3 : 1}
        style={{ transition: "fill 140ms, opacity 140ms" }}
      />
    </g>
  );
}

/** One sentence a screen reader can act on, rebuilt per frame. */
function ariaLabel(state: MutationState): string {
  if (state.baselineGreen === false) {
    return "The test suite fails the unmutated code, so no mutation result is meaningful.";
  }
  if (state.running) {
    const subject = state.running.mutantId ?? "the baseline";
    return `Running ${state.running.testName} against ${subject}. ${state.killed} mutants killed, ${state.survived} survived of ${state.mutants.length}.`;
  }
  const survivors = state.mutants
    .filter((m) => m.status === "survived")
    .map((m) => m.label);
  return survivors.length > 0
    ? `${state.killed} of ${state.mutants.length} mutants killed. Surviving: ${survivors.join("; ")}.`
    : `${state.killed} of ${state.mutants.length} mutants killed, ${state.survived} survived.`;
}
