"use client";

import { cn } from "@/lib/cn";
import type { MeterSpec } from "../types";

interface MeterProps {
  spec: MeterSpec;
  value: number;
  /**
   * Sample ring for "sparkline" meters — `snapshot.series[spec.metricKey]`.
   * Absent or empty renders the readout alone (no trace, no placeholder).
   */
  series?: number[];
}

function isDanger(spec: MeterSpec, value: number): boolean {
  if (spec.dangerAbove !== undefined && value > spec.dangerAbove) return true;
  if (spec.dangerBelow !== undefined && value < spec.dangerBelow) return true;
  return false;
}

/* ---------- danger thresholds ---------- */

/** Where a danger limit sits on a scaled track. */
interface ThresholdMark {
  /** The limit's value, in metric units. */
  value: number;
  /** Its position on the track, 0..1 (clamped — a limit past `max` pins right). */
  at: number;
}

/**
 * The limits worth drawing on a bar/gauge track.
 *
 * "Red past 90" is invisible until it's too late, and the redness itself is a
 * color-only signal. A tick at the limit is neither: it says where the edge is
 * *before* the value gets there, and it says it geometrically, so it survives
 * a screenshot in greyscale and a viewer who can't tell amber from red.
 *
 * Only scaled kinds get them — a counter has no track to put a tick on.
 */
function thresholdMarks(spec: MeterSpec): ThresholdMark[] {
  const max = spec.max;
  if (!max) return [];
  const marks: ThresholdMark[] = [];
  for (const value of [spec.dangerAbove, spec.dangerBelow]) {
    if (value === undefined) continue;
    marks.push({ value, at: Math.min(Math.max(value / max, 0), 1) });
  }
  return marks;
}

/**
 * A mark the fill has swallowed has to invert or it disappears into it (red
 * tick, red bar) — so a crossed limit reads as a notch cut out of the fill.
 */
function markColor(mark: ThresholdMark, value: number): string {
  return value >= mark.value ? "var(--color-bg)" : "var(--color-glow-red)";
}

/* ---------- sparkline ---------- */

const SPARK_W = 44;
const SPARK_H = 14;
/** Samples drawn; older ones scroll off the left. */
const SPARK_WINDOW = 80;

interface SparkRun {
  color: string;
  points: string;
}

/**
 * Turn a sample ring into as few polylines as possible: the trace is faint,
 * samples over `dangerAbove` go red, and the newest segment is accented so the
 * eye finds "now". Consecutive same-color segments merge into one run, so a
 * calm series is a single polyline even at 80 samples.
 */
function sparkRuns(values: number[], dangerAbove?: number): SparkRun[] {
  const window = values.slice(-SPARK_WINDOW);
  if (window.length < 2) return [];

  let lo = Infinity;
  let hi = -Infinity;
  for (const v of window) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  // Flat series would divide by zero — draw it down the middle instead.
  const span = hi - lo;
  const inset = 1; // keep the 1px stroke inside the box
  const x = (i: number) => (i / (window.length - 1)) * SPARK_W;
  const y = (v: number) =>
    span === 0
      ? SPARK_H / 2
      : SPARK_H - inset - ((v - lo) / span) * (SPARK_H - inset * 2);

  const colorAt = (i: number): string => {
    if (dangerAbove !== undefined && window[i] > dangerAbove) {
      return "var(--color-glow-red)";
    }
    return i === window.length - 1
      ? "var(--color-accent)"
      : "var(--color-fg-faint)";
  };

  const runs: SparkRun[] = [];
  let current: { color: string; pts: string[] } | null = null;
  for (let i = 1; i < window.length; i++) {
    // A segment takes the color of the sample it arrives at.
    const color = colorAt(i);
    const from = `${x(i - 1).toFixed(1)},${y(window[i - 1]).toFixed(1)}`;
    const to = `${x(i).toFixed(1)},${y(window[i]).toFixed(1)}`;
    if (current && current.color === color) {
      current.pts.push(to);
    } else {
      if (current) runs.push({ color: current.color, points: current.pts.join(" ") });
      current = { color, pts: [from, to] };
    }
  }
  if (current) runs.push({ color: current.color, points: current.pts.join(" ") });
  return runs;
}

/* ---------- accessible naming ---------- */

/** "62 req/s", plus which side of the limit it's on when that matters. */
function valueText(spec: MeterSpec, display: string): string {
  const unit = spec.unit ? ` ${spec.unit}` : "";
  return `${display}${unit}`;
}

/** How a limit reads out loud once crossed. */
function limitText(spec: MeterSpec, value: number): string {
  if (spec.dangerAbove !== undefined && value > spec.dangerAbove) {
    return `, above the ${spec.dangerAbove}${spec.unit ? ` ${spec.unit}` : ""} limit`;
  }
  if (spec.dangerBelow !== undefined && value < spec.dangerBelow) {
    return `, below the ${spec.dangerBelow}${spec.unit ? ` ${spec.unit}` : ""} floor`;
  }
  return "";
}

/**
 * A sparkline's information is a shape, not a point on a scale, so it is
 * described rather than measured: where the trace is now and how far it has
 * ranged over the drawn window.
 */
function sparklineLabel(
  spec: MeterSpec,
  value: number,
  display: string,
  series?: number[],
): string {
  const head = `${spec.label}: ${valueText(spec, display)}${limitText(spec, value)}`;
  const window = (series ?? []).slice(-SPARK_WINDOW);
  if (window.length < 2) return head;
  const decimals = spec.decimals ?? 0;
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of window) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const unit = spec.unit ? ` ${spec.unit}` : "";
  return `${head}. Last ${window.length} samples ranged ${lo.toFixed(decimals)} to ${hi.toFixed(decimals)}${unit}`;
}

/**
 * ARIA for one instrument.
 *
 * `role="meter"` is the exact role for "a reading inside a known range", and
 * it is what bar and gauge meters are — they already have a `max` to scale by,
 * so `aria-valuemin/now/max` are true statements and assistive tech can report
 * the number, its bounds, and (via `aria-valuetext`) its unit without a live
 * region firing ten times a second. Where the role is unsupported it degrades
 * to a labeled group that still exposes the name and value text.
 *
 * The two kinds without a range don't get it, because a meter *must* have one:
 * ARIA defaults `aria-valuemax` to 100, so a max-less counter reading 240 ms
 * would be announced as 240% of a range that doesn't exist. Those (and the
 * sparkline, whose value is a distribution) take `role="img"` with a label
 * that already says everything the widget shows.
 */
function meterAria(
  spec: MeterSpec,
  value: number,
  display: string,
  series?: number[],
) {
  if (spec.kind === "sparkline") {
    return {
      role: "img" as const,
      "aria-label": sparklineLabel(spec, value, display, series),
    };
  }
  if (spec.max === undefined) {
    return {
      role: "img" as const,
      "aria-label": `${spec.label}: ${valueText(spec, display)}${limitText(spec, value)}`,
    };
  }
  return {
    role: "meter" as const,
    "aria-label": spec.label,
    // The rounded readout, so speech and screen never disagree.
    "aria-valuenow": Number(display),
    "aria-valuemin": 0,
    "aria-valuemax": spec.max,
    "aria-valuetext": `${valueText(spec, display)}${limitText(spec, value)}`,
  };
}

/**
 * One live instrument. Values arrive at 10Hz; CSS transitions interpolate
 * so the display reads continuous.
 */
export function Meter({ spec, value, series }: MeterProps) {
  const danger = isDanger(spec, value);
  const display = value.toFixed(spec.decimals ?? 0);
  const accent = danger ? "var(--color-glow-red)" : "var(--color-accent)";
  const fraction = spec.max ? Math.min(value / spec.max, 1) : 0;
  const runs =
    spec.kind === "sparkline" ? sparkRuns(series ?? [], spec.dangerAbove) : [];
  const marks =
    spec.kind === "bar" || spec.kind === "gauge" ? thresholdMarks(spec) : [];

  return (
    <div
      className="flex min-w-0 flex-col gap-1"
      {...meterAria(spec, value, display, series)}
    >
      <span className="tech-label truncate">{spec.label}</span>

      {spec.kind === "counter" && (
        <span
          className={cn(
            "tech-num text-lg leading-none font-semibold transition-colors",
            danger ? "text-glow-red" : "text-fg",
          )}
        >
          {display}
          {spec.unit && (
            <span className="ml-1 text-[11px] font-normal text-fg-faint">
              {spec.unit}
            </span>
          )}
        </span>
      )}

      {spec.kind === "bar" && (
        <div className="flex items-center gap-2">
          <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full"
              style={{
                width: `${fraction * 100}%`,
                background: accent,
                transition: "width 150ms linear, background 300ms",
              }}
            />
            {marks.map((mark) => (
              <span
                key={mark.value}
                aria-hidden
                className="absolute inset-y-0 w-0.5"
                style={{
                  // Straddle the limit, and stay inside the clipped track at
                  // either end (a tick at max would otherwise be cropped away).
                  left: `calc(${(mark.at * 100).toFixed(2)}% - 1px)`,
                  background: markColor(mark, value),
                  transition: "background 300ms",
                }}
              />
            ))}
          </div>
          <span
            className={cn(
              "tech-num w-12 text-right text-xs",
              danger ? "text-glow-red" : "text-fg-muted",
            )}
          >
            {display}
            {spec.unit}
          </span>
        </div>
      )}

      {spec.kind === "sparkline" && (
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "tech-num text-sm font-semibold transition-colors",
              danger ? "text-glow-red" : "text-fg",
            )}
          >
            {display}
            {spec.unit && (
              <span className="ml-0.5 text-[10px] font-normal text-fg-faint">
                {spec.unit}
              </span>
            )}
          </span>
          <svg
            width={SPARK_W}
            height={SPARK_H}
            viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
            aria-hidden
            className="shrink-0 overflow-visible"
          >
            {runs.map((run, i) => (
              <polyline
                key={i}
                points={run.points}
                fill="none"
                stroke={run.color}
                strokeWidth={1}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          </svg>
        </div>
      )}

      {spec.kind === "gauge" && (
        <div className="flex items-center gap-2">
          <svg width={44} height={26} viewBox="0 0 44 26" aria-hidden>
            <path
              d="M 4 24 A 18 18 0 0 1 40 24"
              fill="none"
              stroke="var(--color-border)"
              strokeWidth={4}
              strokeLinecap="round"
            />
            <path
              d="M 4 24 A 18 18 0 0 1 40 24"
              fill="none"
              stroke={accent}
              strokeWidth={4}
              strokeLinecap="round"
              strokeDasharray={Math.PI * 18}
              strokeDashoffset={Math.PI * 18 * (1 - fraction)}
              style={{
                transition:
                  "stroke-dashoffset 150ms linear, stroke 300ms",
              }}
            />
            {marks.map((mark) => {
              // The track is the semicircle r=18 about (22,24), swept from
              // 180° (left) to 0° (right); the tick is the radius through it.
              const angle = Math.PI * mark.at;
              const cos = Math.cos(angle);
              const sin = Math.sin(angle);
              return (
                <line
                  key={mark.value}
                  x1={22 - 14.5 * cos}
                  y1={24 - 14.5 * sin}
                  x2={22 - 21.5 * cos}
                  y2={24 - 21.5 * sin}
                  stroke={markColor(mark, value)}
                  strokeWidth={1.5}
                  style={{ transition: "stroke 300ms" }}
                />
              );
            })}
          </svg>
          <span
            className={cn(
              "tech-num text-sm font-semibold",
              danger ? "text-glow-red" : "text-fg",
            )}
          >
            {display}
            {spec.unit && (
              <span className="ml-0.5 text-[10px] font-normal text-fg-faint">
                {spec.unit}
              </span>
            )}
          </span>
        </div>
      )}
    </div>
  );
}
