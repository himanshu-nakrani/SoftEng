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

  return (
    <div className="flex min-w-0 flex-col gap-1">
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
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full"
              style={{
                width: `${fraction * 100}%`,
                background: accent,
                transition: "width 150ms linear, background 300ms",
              }}
            />
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
