"use client";

import { Button } from "@/components/ui/Button";
import { GlowCard } from "@/components/ui/GlowCard";
import { useTrackProgress } from "@/hooks/use-lesson-progress";
import { lessonPath, nextLesson } from "@/lib/curriculum";
import { useProgress } from "@/stores/progress";
import { ArrowRight, Map as MapIcon, RotateCcw, Sparkles } from "lucide-react";
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
      <Link href="/learn" className="group mt-16 block">
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
    <GlowCard accent="green" active className="mt-16 px-5 py-4">
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

/** Bottom-of-lesson forward navigation. */
export function NextLessonCard() {
  const meta = useLessonMeta();
  const next = nextLesson(meta.slug);

  if (!next) return <EndOfTrackCard />;

  if (next.status === "coming-soon") {
    return (
      <div className="mt-16 rounded-xl border border-border bg-surface px-5 py-4 opacity-60">
        <p className="tech-label mb-1 flex items-center gap-1.5">
          <Sparkles className="size-3" />
          next up — coming soon
        </p>
        <p className="font-display text-lg font-semibold">{next.title}</p>
      </div>
    );
  }

  return (
    <Link href={lessonPath(next)} className="group mt-16 block">
      <GlowCard className="flex items-center gap-4 px-5 py-4">
        <div>
          <p className="tech-label mb-1">next lesson</p>
          <p className="font-display text-lg font-semibold">{next.title}</p>
        </div>
        <ArrowRight className="ml-auto size-5 text-accent transition-transform group-hover:translate-x-1" />
      </GlowCard>
    </Link>
  );
}
