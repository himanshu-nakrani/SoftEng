"use client";

import type { Accent } from "@/curriculum/types";
import type { LessonState } from "@/hooks/use-lesson-progress";
import { cn } from "@/lib/cn";
import { accentCssVar } from "@/lib/accent";

interface ProgressRingProps {
  fraction: number; // 0..1
  state: LessonState;
  /**
   * Complete AND every recorded checkpoint right first try. Only meaningful
   * alongside `state === "complete"`; ignored otherwise.
   */
  mastered?: boolean;
  accent?: Accent;
  size?: number;
  className?: string;
}

/**
 * Lesson progress indicator: hollow ring (untouched) → sweeping arc
 * (in-progress) → filled disc with check (complete) → the same disc with a
 * halo ring and accent bloom (mastered). The mastery step is deliberately a
 * light difference, not a different shape: at 16px in the sidebar a second
 * glyph would read as a different kind of thing rather than a better grade.
 */
export function ProgressRing({
  fraction,
  state,
  mastered = false,
  accent = "amber",
  size = 20,
  className,
}: ProgressRingProps) {
  const color = accentCssVar[accent];
  const r = size / 2 - 2;
  const c = 2 * Math.PI * r;
  const isMastered = state === "complete" && mastered;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={cn("shrink-0", className)}
      role="img"
      aria-label={
        isMastered
          ? "Lesson mastered — every checkpoint right first try"
          : state === "complete"
            ? "Lesson complete"
            : state === "in-progress"
              ? `Lesson ${Math.round(fraction * 100)}% complete`
              : "Lesson not started"
      }
    >
      {state === "complete" ? (
        <>
          {isMastered && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={size / 2 - 0.5}
              fill="none"
              stroke={color}
              strokeWidth={1}
              opacity={0.4}
            />
          )}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={isMastered ? r : r + 1}
            fill={color}
            style={
              isMastered ? { filter: `drop-shadow(0 0 4px ${color})` } : undefined
            }
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
