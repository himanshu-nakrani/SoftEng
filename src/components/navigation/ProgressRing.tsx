"use client";

import type { Accent } from "@/curriculum/types";
import type { LessonState } from "@/hooks/use-lesson-progress";
import { cn } from "@/lib/cn";

const accentVar: Record<Accent, string> = {
  cyan: "var(--color-glow-cyan)",
  violet: "var(--color-glow-violet)",
  amber: "var(--color-glow-amber)",
  green: "var(--color-glow-green)",
  red: "var(--color-glow-red)",
};

interface ProgressRingProps {
  fraction: number; // 0..1
  state: LessonState;
  accent?: Accent;
  size?: number;
  className?: string;
}

/**
 * Lesson progress indicator: hollow ring (untouched) → sweeping arc
 * (in-progress) → filled glowing disc with check (complete).
 */
export function ProgressRing({
  fraction,
  state,
  accent = "amber",
  size = 20,
  className,
}: ProgressRingProps) {
  const color = accentVar[accent];
  const r = size / 2 - 2;
  const c = 2 * Math.PI * r;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={cn("shrink-0", className)}
      role="img"
      aria-label={
        state === "complete"
          ? "Lesson complete"
          : state === "in-progress"
            ? `Lesson ${Math.round(fraction * 100)}% complete`
            : "Lesson not started"
      }
    >
      {state === "complete" ? (
        <>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r + 1}
            fill={color}
            style={{ filter: `drop-shadow(0 0 4px ${color})` }}
          />
          <path
            d={`M ${size * 0.3} ${size * 0.52} L ${size * 0.44} ${size * 0.66} L ${size * 0.7} ${size * 0.36}`}
            fill="none"
            stroke="var(--color-bg)"
            strokeWidth={size / 10}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      ) : (
        <>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--color-border-bright)"
            strokeWidth={2}
          />
          {state === "in-progress" && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={color}
              strokeWidth={2}
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={c * (1 - fraction)}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              className="transition-[stroke-dashoffset] duration-500"
            />
          )}
        </>
      )}
    </svg>
  );
}
