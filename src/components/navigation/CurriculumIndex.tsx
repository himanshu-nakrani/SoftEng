"use client";

import { ProgressRing } from "@/components/navigation/ProgressRing";
import { accentCssVar } from "@/lib/accent";
import { cn } from "@/lib/cn";
import { trackLabel, trackPath, tracks } from "@/lib/curriculum";
import { useTrackProgress } from "@/hooks/use-lesson-progress";
import type { Track } from "@/curriculum/types";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

/**
 * One row of the curriculum index.
 *
 * A separate component per track because each one calls `useTrackProgress`,
 * and a hook cannot be called in a loop body — the row IS the loop body.
 */
function TrackRow({ track }: { track: Track }) {
  const progress = useTrackProgress(track.slug);
  const live = track.modules
    .flatMap((m) => m.lessons)
    .filter((l) => l.status === "available").length;
  const pct = Math.round(progress.fraction * 100);

  return (
    <Link
      href={trackPath(track)}
      className="module-row group relative grid items-baseline gap-x-8 gap-y-2 py-6 md:grid-cols-[110px_1fr_auto_auto]"
    >
      {/* accent spine, revealed on hover — the same affordance as the landing
          page's module manifest, so the two indexes read as one grammar */}
      <span
        className="absolute top-0 bottom-0 left-0 w-0.5 opacity-0 transition-opacity group-hover:opacity-100"
        style={{ background: accentCssVar[track.accent] }}
      />

      <span className="tech-num pl-4 text-xs text-fg-faint md:pl-0">
        <span
          className="mr-2 inline-block size-1.5 rounded-full align-middle"
          style={{
            background: accentCssVar[track.accent],
            boxShadow: `0 0 6px ${accentCssVar[track.accent]}`,
          }}
        />
        {trackLabel(track)}
      </span>

      <span className="pl-4 md:pl-0">
        <span className="font-display block text-lg font-semibold">
          {track.title}
        </span>
        <span className="mt-0.5 block text-sm leading-relaxed text-fg-muted">
          {track.description}
        </span>
      </span>

      <span className="tech-num pl-4 text-xs whitespace-nowrap text-fg-faint md:pl-0">
        {track.modules.length} modules · {live} lesson{live === 1 ? "" : "s"}
      </span>

      <span className="flex items-center gap-2.5 pl-4 md:pl-0">
        <ProgressRing
          size={20}
          fraction={progress.fraction}
          state={
            progress.fraction >= 1
              ? "complete"
              : progress.done > 0
                ? "in-progress"
                : "untouched"
          }
          accent={track.accent}
        />
        <span
          className={cn(
            "tech-num text-xs whitespace-nowrap",
            pct > 0 ? "text-fg-muted" : "text-fg-faint",
          )}
        >
          {pct}%
        </span>
        <ArrowRight
          className="size-3.5 shrink-0 text-fg-faint transition-transform group-hover:translate-x-0.5"
          strokeWidth={1.75}
        />
      </span>
    </Link>
  );
}

/**
 * The curriculum index: every track, with its own progress.
 *
 * Deliberately NOT a single aggregate percentage. Tracks are parallel courses,
 * not chapters of one book, so "14% of software engineering" would be both
 * meaningless and discouraging — each track carries its own denominator.
 */
export function CurriculumIndex() {
  return (
    <div>
      {tracks.map((track) => (
        <TrackRow key={track.slug} track={track} />
      ))}
    </div>
  );
}
