"use client";

import { Button } from "@/components/ui/Button";
import { GlowCard } from "@/components/ui/GlowCard";
import { Kbd } from "@/components/ui/Kbd";
import { useTrackProgress } from "@/hooks/use-lesson-progress";
import type { LessonMeta } from "@/curriculum/types";
import { lessonPath, nextLesson, prevLesson } from "@/lib/curriculum";
import { useProgress } from "@/stores/progress";
import {
  ArrowLeft,
  ArrowRight,
  Map as MapIcon,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useLessonMeta } from "./context";

/**
 * The last lesson in the registry is the end of the ROUTE, not proof of
 * completion — anyone can scroll here on their first visit. So the card is
 * decided by the store measured against the registry's section denominators:
 * celebrate only a genuinely finished track, otherwise name what's left.
 */
function EndOfTrackCard() {
  const track = useTrackProgress();
  const resetAll = useProgress((s) => s.resetAll);
  const [confirming, setConfirming] = useState(false);

  const open = Math.max(track.total - track.done, 0);

  if (open > 0) {
    return (
      <Link href="/learn" className="group block">
        <GlowCard className="flex items-center gap-4 px-5 py-4">
          <div>
            <p className="tech-label mb-1">end of the track</p>
            <p className="font-display text-lg font-semibold">
              {open} section{open === 1 ? "" : "s"} still open
            </p>
            <p className="text-sm text-fg-muted">
              Back to the map to pick up what you skipped.
            </p>
          </div>
          <MapIcon
            className="ml-auto size-5 shrink-0 text-accent transition-transform group-hover:translate-x-1"
            strokeWidth={1.75}
          />
        </GlowCard>
      </Link>
    );
  }

  return (
    <GlowCard accent="green" active className="px-5 py-4">
      <p className="tech-label mb-1 flex items-center gap-1.5 text-glow-green">
        <Sparkles className="size-3" strokeWidth={2} />
        track complete
      </p>
      <p className="font-display text-lg font-semibold">
        All {track.total} sections across {track.lessons} lessons.
      </p>
      <p className="mt-0.5 text-sm text-fg-muted">
        {track.lessonsMastered > 0
          ? `${track.lessonsMastered} mastered — every checkpoint right first try.`
          : "Replay any lesson from the map — the sims are seeded, so runs repeat exactly."}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Link href="/learn">
          <Button size="sm" variant="outline">
            <MapIcon className="size-3.5" strokeWidth={1.75} />
            Back to the map
          </Button>
        </Link>

        {confirming ? (
          <>
            <span className="font-mono text-[11px] text-glow-orange">
              clears all progress on this device
            </span>
            <Button
              size="sm"
              onClick={() => {
                resetAll();
                setConfirming(false);
              }}
              className="border-glow-orange/60 text-glow-orange hover:bg-glow-orange-dim"
            >
              Yes, replay from zero
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => setConfirming(true)}>
            <RotateCcw className="size-3.5" strokeWidth={1.75} />
            Replay the track
          </Button>
        )}
      </div>
    </GlowCard>
  );
}

/**
 * The way back. Quiet by construction — a ghost outline against the next
 * lesson's glow card — because moving on is the default and re-reading is the
 * exception. Shown only for a shipped neighbour, so the `[` shortcut and this
 * link are true or absent together.
 */
function PrevLessonLink({ lesson }: { lesson: LessonMeta }) {
  return (
    <Link
      href={lessonPath(lesson)}
      className="group flex items-center gap-3 rounded-xl border border-border px-4 py-3 transition-colors hover:border-border-bright hover:bg-surface/60 sm:w-64 sm:shrink-0"
    >
      <ArrowLeft
        className="size-4 shrink-0 text-fg-faint transition-transform group-hover:-translate-x-0.5"
        strokeWidth={1.75}
      />
      <span className="min-w-0">
        <span className="tech-label flex items-center gap-1.5">
          previous <Kbd>[</Kbd>
        </span>
        <span className="mt-0.5 block truncate text-sm text-fg-muted transition-colors group-hover:text-fg">
          {lesson.title}
        </span>
      </span>
    </Link>
  );
}

/** Bottom-of-lesson navigation: the next lesson, with a way back beside it. */
export function NextLessonCard() {
  const meta = useLessonMeta();
  const next = nextLesson(meta.slug);
  const prev = prevLesson(meta.slug);

  const forward = !next ? (
    <EndOfTrackCard />
  ) : next.status === "coming-soon" ? (
    <div className="rounded-xl border border-border bg-surface px-5 py-4 opacity-60">
      <p className="tech-label mb-1 flex items-center gap-1.5">
        <Sparkles className="size-3" />
        next up — coming soon
      </p>
      <p className="font-display text-lg font-semibold">{next.title}</p>
    </div>
  ) : (
    <Link href={lessonPath(next)} className="group block">
      <GlowCard className="flex items-center gap-4 px-5 py-4">
        <div className="min-w-0">
          <p className="tech-label mb-1 flex items-center gap-1.5">
            next lesson <Kbd>]</Kbd>
          </p>
          <p className="font-display text-lg font-semibold">{next.title}</p>
        </div>
        <ArrowRight className="ml-auto size-5 shrink-0 text-accent transition-transform group-hover:translate-x-1" />
      </GlowCard>
    </Link>
  );

  return (
    // Column on phones (back below the star, where it stays out of the way),
    // row from sm up. The `mt-16` that each branch used to carry lives here now
    // so both halves share one top edge.
    <div className="mt-16 flex flex-col-reverse gap-3 sm:flex-row sm:items-stretch">
      {prev?.status === "available" && <PrevLessonLink lesson={prev} />}
      <div className="min-w-0 flex-1">{forward}</div>
    </div>
  );
}
