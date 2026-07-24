"use client";

import type { AlgoStep } from "./types";

const VIEW_W = 800;
const VIEW_H = 300;
const BASE_Y = 264; // bars grow up from here
const MAX_BAR_H = 220;

/**
 * The bar-race stage. Discrete steps, CSS-transitioned geometry — bars
 * glide to their new heights between steps.
 *
 * Color language: cyan = comparing · amber = swapping/writing ·
 * green = settled · violet = pivot.
 */
export function ArrayView({ step }: { step: AlgoStep }) {
  const { array, highlight } = step;
  const n = array.length;
  const slot = VIEW_W / n;
  const barW = Math.min(slot * 0.7, 56);
  const showLabels = n <= 24;

  const sorted = new Set(highlight.sorted ?? []);
  const compare = new Set(highlight.compare ?? []);
  const swap = new Set(highlight.swap ?? []);

  const fillFor = (i: number): string => {
    if (swap.has(i)) return "var(--color-accent)";
    if (i === highlight.pivot) return "var(--color-glow-violet)";
    if (compare.has(i)) return "var(--color-glow-cyan)";
    if (sorted.has(i)) return "var(--color-glow-green)";
    return "var(--color-border-bright)";
  };

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      className="block h-auto w-full"
      role="img"
      aria-label={`Array of ${n} values${highlight.compare ? `, comparing positions ${highlight.compare.join(" and ")}` : ""}`}
    >
      {/* active-range band (divide & conquer) */}
      {highlight.range && (
        <rect
          x={highlight.range[0] * slot + 2}
          y={20}
          width={(highlight.range[1] - highlight.range[0] + 1) * slot - 4}
          height={BASE_Y - 12}
          rx={6}
          fill="var(--color-glow-violet)"
          opacity={0.07}
          style={{ transition: "x 150ms, width 150ms" }}
        />
      )}

      {/* baseline */}
      <line
        x1={8}
        y1={BASE_Y}
        x2={VIEW_W - 8}
        y2={BASE_Y}
        stroke="var(--color-border)"
        strokeWidth={1}
      />

      {array.map((value, i) => {
        const h = (value / 100) * MAX_BAR_H;
        const x = i * slot + (slot - barW) / 2;
        const active =
          compare.has(i) || swap.has(i) || i === highlight.pivot;
        return (
          <g key={i}>
            <rect
              x={x}
              y={BASE_Y - h}
              width={barW}
              height={h}
              rx={3}
              fill={fillFor(i)}
              opacity={sorted.has(i) && !active ? 0.55 : active ? 1 : 0.8}
              style={{
                transition:
                  "y 140ms ease, height 140ms ease, fill 140ms, opacity 140ms",
                filter: active
                  ? `drop-shadow(0 0 6px ${fillFor(i)})`
                  : undefined,
              }}
            />
            {showLabels && (
              <text
                x={x + barW / 2}
                y={BASE_Y + 16}
                textAnchor="middle"
                fill={active ? "var(--color-fg)" : "var(--color-fg-faint)"}
                style={{ font: "500 10px var(--font-plex-mono)" }}
              >
                {value}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
