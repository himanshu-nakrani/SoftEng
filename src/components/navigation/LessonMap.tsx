"use client";

import { ProgressRing } from "@/components/navigation/ProgressRing";
import { ProgressSettings } from "@/components/navigation/ProgressSettings";
import { GlowCard } from "@/components/ui/GlowCard";
import { SectionRule } from "@/components/ui/SectionRule";
import type { LessonMeta, Module } from "@/curriculum/types";
import type { LearningActivity } from "@/hooks/use-lesson-progress";
import { useHydrated } from "@/hooks/use-hydrated";
import {
  lessonFraction,
  sectionsDone,
  useLessonProgress,
  useTrackProgress,
} from "@/hooks/use-lesson-progress";
import { cn } from "@/lib/cn";
import { accentCssVar, difficultyClass } from "@/lib/accent";
import {
  accentOf,
  getLesson,
  getTrack,
  lessonPath,
  lessonsOfTrack,
  prerequisiteLabels,
  trackOfLesson,
} from "@/lib/curriculum";
import { useProgress } from "@/stores/progress";
import { ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";


const activityLabel: Record<LearningActivity, string> = {
  untouched: "not started",
  explored: "explored",
  predicted: "predicted",
  complete: "complete",
  mastered: "mastered",
};

/**
 * Track-level readout: one headline % plus a section-weighted segmented bar,
 * one segment per module in its accent. The lesson map below answers "where
 * am I in this lesson"; only this answers "how far through THIS track am I".
 *
 * Takes a slug rather than a `Track` object so a server page can render it
 * without serialising the whole registry subtree into the RSC payload — the
 * client already has the registry in its module graph.
 */
export function TrackProgress({ trackSlug }: { trackSlug: string }) {
  // useTrackProgress is hydration-gated internally: pre-mount it reports the
  // logged-out snapshot (0 done / every section open), which is exactly the
  // markup the static HTML carries.
  const track = useTrackProgress(trackSlug);
  const pct = Math.round(track.fraction * 100);

  return (
    <GlowCard className="mb-10 px-5 py-4">
      <SectionRule className="mb-3">
        <span className="tech-label">track progress</span>
        <span className="tech-num ml-auto text-2xl leading-none font-semibold text-accent">
          {pct}
          <span className="text-sm text-fg-faint">%</span>
        </span>
      </SectionRule>

      {/* tick-scale: one tick per section in the track, filled in the module's
          accent as it completes — a tally, not a bar. Ticks are fluid
          (flex-1) so the ruler always spans its container exactly, whatever
          the section count and viewport */}
      <div className="mb-3 flex items-end gap-[3px] overflow-hidden" aria-hidden>
        {track.segments.map((seg) => {
          const filled = Math.round(seg.fraction * seg.total);
          return Array.from({ length: seg.total }, (_, i) => (
            <span
              key={`${seg.module.slug}:${i}`}
              className={cn(
                "min-w-0 flex-1 transition-colors duration-700",
                i < filled ? "h-2.5" : "h-1.5 bg-border",
              )}
              style={
                i < filled
                  ? {
                      background: accentCssVar[accentOf(seg.module)],
                      boxShadow: `0 0 6px -1px ${accentCssVar[accentOf(seg.module)]}`,
                    }
                  : undefined
              }
            />
          ));
        })}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {track.segments.map((seg) => (
          <a
            key={seg.module.slug}
            href={`#${seg.module.slug}`}
            className="group flex items-center gap-1.5 font-mono text-[11px] text-fg-faint transition-colors hover:text-fg-muted"
          >
            <span
              className="size-1.5 shrink-0 rounded-full"
              style={{
                background: accentCssVar[accentOf(seg.module)],
                opacity: seg.fraction > 0 ? 1 : 0.35,
              }}
            />
            <span className="group-hover:text-fg">{seg.module.title}</span>
            <span className="tech-num">
              {seg.lessonsComplete}/{seg.lessons}
            </span>
          </a>
        ))}
        <span className="tech-num ml-auto text-[11px] text-fg-faint">
          {track.done} / {track.total} sections
          <span className="hidden sm:inline">
            {` · ${track.lessonsExplored}/${track.lessons} explored`}
            {track.lessonsPredicted > 0 && ` · ${track.lessonsPredicted} predicted`}
          </span>
          {track.lessonsMastered > 0 && (
            <span className="text-accent"> · {track.lessonsMastered} mastered</span>
          )}
        </span>
      </div>

      <div className="mt-3 border-t border-border pt-3">
        <ProgressSettings />
      </div>
    </GlowCard>
  );
}

/**
 * "Continue where you left off", from persisted lastVisited — deep-linked to
 * the exact section the reader left (lesson sections carry ids + scroll-mt).
 * Degrades in three steps: a lesson from ANOTHER track is ignored here (its
 * own track page owns that prompt), a finished lesson retargets to the next
 * unfinished one in this track, and a finished track celebrates instead of
 * pretending there's more.
 */
function ContinueCard({ trackSlug }: { trackSlug: string }) {
  const hydrated = useHydrated();
  const lastVisited = useProgress((s) => s.lastVisited);
  const completedSections = useProgress((s) => s.completedSections);

  const track = getTrack(trackSlug);
  if (!hydrated || !track) return null;

  const trackLessons = lessonsOfTrack(track);
  const openInTrack = trackLessons.find(
    (l) => l.status === "available" && lessonFraction(l, completedSections) < 1,
  );

  const lesson = lastVisited ? getLesson(lastVisited.lessonSlug) : undefined;
  const resumable =
    lesson &&
    lesson.status === "available" &&
    trackOfLesson(lesson).slug === trackSlug
      ? lesson
      : undefined;

  if (resumable) {
    const done = sectionsDone(resumable, completedSections);
    const total = resumable.sections.length;

    if (done < total) {
      // Only deep-link to a section the registry still has; a renamed or
      // dropped id would scroll nowhere, so fall back to the lesson top.
      const section = resumable.sections.find(
        (sec) => sec.id === lastVisited?.sectionId,
      );
      const href = section
        ? `${lessonPath(resumable)}#${section.id}`
        : lessonPath(resumable);

      return (
        <ResumeCard
          href={href}
          label="Continue where you left off"
          title={resumable.title}
          detail={section?.title}
          count={`${done}/${total}`}
        />
      );
    }
  }

  // Nothing resumable in this track: either every section is done, or the
  // reader has not started it yet. Say nothing in the untouched case — an
  // empty track already reads as "start at the top".
  if (!openInTrack) {
    if (!resumable) return null;
    return (
      <GlowCard accent="green" active className="mb-12 flex items-center gap-3 px-5 py-4">
        <Sparkles className="size-5 shrink-0 text-glow-green" strokeWidth={1.75} />
        <div>
          <p className="tech-label mb-0.5 text-glow-green">track complete</p>
          <p className="font-display text-lg font-semibold">
            Every section done. Revisit any lesson below.
          </p>
        </div>
      </GlowCard>
    );
  }

  if (!resumable) return null;

  return (
    <ResumeCard
      href={lessonPath(openInTrack)}
      label="Up next"
      title={openInTrack.title}
      detail={openInTrack.tagline}
      count={`${sectionsDone(openInTrack, completedSections)}/${openInTrack.sections.length}`}
    />
  );
}

function ResumeCard({
  href,
  label,
  title,
  detail,
  count,
}: {
  href: string;
  label: string;
  title: string;
  detail?: string;
  count: string;
}) {
  return (
    <Link href={href} className="group block">
      <GlowCard active className="mb-12 flex items-center gap-4 px-5 py-4">
        <div className="min-w-0">
          <p className="tech-label mb-0.5">{label}</p>
          <p className="font-display truncate text-lg font-semibold">{title}</p>
          {detail && (
            <p className="truncate text-sm text-fg-muted">{detail}</p>
          )}
        </div>
        <span className="tech-num ml-auto shrink-0 text-sm text-fg-faint">
          {count}
        </span>
        <ArrowRight className="size-5 shrink-0 text-accent transition-transform group-hover:translate-x-1" />
      </GlowCard>
    </Link>
  );
}

function MapNode({
  lesson,
  module: mod,
  index,
}: {
  lesson: LessonMeta;
  module: Module;
  index: number;
}) {
  const progress = useLessonProgress(lesson);

  const row = (
    <div className="flex-1 rounded-sm border border-transparent px-4 py-3.5 transition-all group-hover:border-border-bright group-hover:bg-surface/60">
      <div className="mb-1 flex items-baseline gap-2.5">
        <span className="tech-num text-[11px] text-fg-faint">
          {String(index).padStart(2, "0")}
        </span>
        <h3 className="font-display text-base font-semibold">
          {lesson.title}
        </h3>
        {progress.activity !== "untouched" ? (
          <span
            className={cn(
              "ml-auto font-mono text-[9px] tracking-widest uppercase",
              progress.activity === "mastered" ? "text-accent" : "text-fg-faint",
            )}
          >
            {activityLabel[progress.activity]}
          </span>
        ) : (
          <ArrowRight className="ml-auto size-3.5 shrink-0 text-fg-faint opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
        )}
      </div>
      <p className="mb-2 text-sm leading-relaxed text-fg-muted">
        {lesson.tagline}
      </p>
      <p className="font-mono text-[11px] tracking-wide text-fg-faint">
        <span className={difficultyClass[lesson.difficulty]}>
          {lesson.difficulty}
        </span>
        {" · "}
        {lesson.estimatedMinutes} min
        {lesson.prerequisites.length > 0 && (
          <span>
            {" · after "}
            {prerequisiteLabels(lesson).join(", ")}
          </span>
        )}
      </p>
    </div>
  );

  return (
    <li className="relative flex gap-4 pb-2">
      {/* spine node */}
      <div className="flex flex-col items-center pt-4">
        <ProgressRing
          size={22}
          fraction={progress.fraction}
          state={progress.state}
          mastered={progress.mastered}
          accent={accentOf(mod)}
        />
        <div className="mt-2 w-px flex-1 bg-border" />
      </div>
      <Link href={lessonPath(lesson)} className="group flex flex-1">
        {row}
      </Link>
    </li>
  );
}

/** The learning-path map for one track: module clusters on a progress spine. */
export function LessonMap({ trackSlug }: { trackSlug: string }) {
  const track = getTrack(trackSlug);
  if (!track) return null;

  return (
    <div className="relative">
      <div className="dot-grid dot-grid-fade pointer-events-none absolute inset-0 -z-10" />
      <ContinueCard trackSlug={trackSlug} />

      {track.modules.map((mod, i) => (
        // id + scroll-mt is a contract with the landing page, which links
        // straight to /learn/<track>#<module-slug>.
        <section key={mod.slug} id={mod.slug} className="mb-12 scroll-mt-24">
          <SectionRule
            className="mb-5"
            trailing={
              <span className="tech-num shrink-0 rounded-sm border border-border bg-raised px-2.5 py-1 text-[10px] text-fg-faint">
                {mod.lessons.length} lessons
              </span>
            }
          >
            <span
              className="size-1.5 shrink-0 self-center rounded-full"
              style={{
                background: accentCssVar[accentOf(mod)],
                boxShadow: `0 0 8px ${accentCssVar[accentOf(mod)]}`,
              }}
            />
            <span className="tech-num shrink-0 text-xs text-fg-faint">
              mod.{String(i + 1).padStart(2, "0")}
            </span>
            <h2 className="font-display text-xl font-bold tracking-tight">{mod.title}</h2>
          </SectionRule>

          <ul className="ml-1">
            {mod.lessons.map((lesson, li) => (
              <MapNode
                key={lesson.slug}
                lesson={lesson}
                module={mod}
                index={li + 1}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
