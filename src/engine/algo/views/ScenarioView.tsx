"use client";

import type { ScenarioOption, ScenarioState } from "./scenario";

const VIEW_W = 800;
const PAD_X = 16;
const OPT_H = 58;
const OPT_GAP = 10;
const BAR_W = 220;

/**
 * The branching-scenario stage: the situation at the top, then each option as a
 * row whose measured outcome is drawn as a bar. The chosen option is ringed
 * amber; the others stay visible so the reader sees what they measured against.
 *
 * The one thing this view exists to make honest is that the bars are MEASURED,
 * not asserted — each is scaled by a real sub-run's pass fraction, and the
 * headline beside it reports the actual counts. There is no "consequence prose"
 * field to draw, by design (the G gate: a choice that only reveals text is a
 * quiz). Grammar shared with the other archetype-B views: amber = the option
 * this step selected · green = a measured-good outcome · orange/red = a measured
 * failure · the figure's own PlateLabel owns the top-right corner.
 */
export function ScenarioView({ state }: { state: ScenarioState }) {
  const { prompt, parameter, options, verdict, sampleSize } = state;

  // Wrap the prompt to the stage width so a long situation never slides off the
  // edge (the WalView lesson: an unwrapped strip clips its tail). It starts well
  // below the header stamps: the first render had the prompt's first line running
  // under the top-left stamp and the right-hand PlateLabel.
  // Keep the prompt in the left two-thirds so it never runs under the figure's
  // floating PlateLabel in the top-right corner (a first-render defect).
  const PROMPT_TOP = 40;
  const promptLines = wrap(prompt, 62);
  const promptH = promptLines.length * 15;

  let y = PROMPT_TOP + promptH + 12;
  const optionsTop = y;
  y += options.length * (OPT_H + OPT_GAP) + 6;
  const verdictY = y + 4;
  const height = verdictY + (verdict ? wrap(verdict, 96).length * 15 + 8 : 0) + 8;

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${height}`}
      className="block h-auto w-full"
      role="img"
      aria-label={ariaLabel(state)}
    >
      {/* Left only: the figure's own PlateLabel owns the top-right corner, so
          the sample-size stamp sits on the LEFT beside the section stamp rather
          than in the middle (where a long prompt line used to collide with it). */}
      <text x={PAD_X} y={16} fill="var(--color-fg-faint)" style={STAMP}>
        SCENARIO · MEASURED OVER {sampleSize} RUNS / OPTION
      </text>

      {promptLines.map((line, i) => (
        <text
          key={i}
          x={PAD_X}
          y={PROMPT_TOP + i * 15}
          fill="var(--color-fg)"
          style={{ font: "500 12px var(--font-plex-mono)" }}
        >
          {line}
        </text>
      ))}
      <text x={PAD_X} y={optionsTop - 6} fill="var(--color-fg-faint)" style={TINY}>
        PARAMETER SET BY YOUR CALL — {parameter.toUpperCase()}
      </text>

      {options.map((opt, i) => (
        <OptionRow key={opt.id} opt={opt} y={optionsTop + i * (OPT_H + OPT_GAP)} />
      ))}

      {verdict &&
        wrap(verdict, 96).map((line, i) => (
          <text
            key={i}
            x={PAD_X}
            y={verdictY + 12 + i * 15}
            fill="var(--color-accent)"
            style={{ font: "600 11px var(--font-plex-mono)" }}
          >
            {i === 0 ? `↳ ${line}` : line}
          </text>
        ))}
    </svg>
  );
}

const STAMP = { font: "500 10px var(--font-plex-mono)", letterSpacing: "0.14em" } as const;
const TINY = { font: "500 9px var(--font-plex-mono)", letterSpacing: "0.08em" } as const;

/** One option: label, its measured bar, and the measured headline. */
function OptionRow({ opt, y }: { opt: ScenarioOption; y: number }) {
  const good = opt.outcome.score >= 0.99;
  const barFill = good
    ? "var(--color-glow-green)"
    : opt.outcome.score >= 0.5
      ? "var(--color-glow-orange)"
      : "var(--color-glow-red)";
  const ring = opt.chosen ? "var(--color-accent)" : "var(--color-border)";
  const barX = VIEW_W - PAD_X - BAR_W;

  return (
    <g transform={`translate(${PAD_X}, ${y})`}>
      <rect
        width={VIEW_W - PAD_X * 2}
        height={OPT_H}
        rx={2}
        fill="var(--color-raised)"
        stroke={ring}
        strokeWidth={opt.chosen ? 2 : 1}
      />
      <text x={12} y={20} fill={opt.chosen ? "var(--color-accent)" : "var(--color-fg)"} style={{ font: "600 12px var(--font-plex-mono)" }}>
        {opt.chosen ? "▶ " : ""}
        {opt.label}
      </text>
      <text x={12} y={40} fill="var(--color-fg-muted)" style={{ font: "500 10px var(--font-plex-mono)" }}>
        {opt.outcome.headline}
      </text>

      {/* the measured bar: track + fill scaled by the real pass fraction */}
      <rect x={barX - 12} y={OPT_H - 16} width={BAR_W} height={8} rx={2} fill="var(--color-bg)" stroke="var(--color-border)" />
      <rect
        x={barX - 12}
        y={OPT_H - 16}
        width={Math.max(2, Math.round(BAR_W * opt.outcome.score))}
        height={8}
        rx={2}
        fill={barFill}
      />
      <text x={VIEW_W - PAD_X - 12} y={OPT_H - 22} textAnchor="end" fill={barFill} style={{ font: "600 12px var(--font-plex-mono)" }}>
        {opt.outcome.value}/{opt.outcome.outOf}
      </text>
    </g>
  );
}

/** Naive word-wrap to a character budget, for prompt and verdict. */
function wrap(text: string, max: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if ((line + " " + word).trim().length > max) {
      if (line) lines.push(line);
      line = word;
    } else {
      line = (line + " " + word).trim();
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** One sentence a screen reader can act on, rebuilt per frame. */
function ariaLabel(state: ScenarioState): string {
  const parts: string[] = [state.prompt];
  for (const opt of state.options) {
    parts.push(
      `${opt.label}${opt.chosen ? " (your choice)" : ""}: ${opt.outcome.value} of ${opt.outcome.outOf} runs correct.`,
    );
  }
  if (state.verdict) parts.push(state.verdict);
  return parts.join(" ");
}
