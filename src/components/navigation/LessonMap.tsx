"use client";

import { ProgressRing } from "@/components/navigation/ProgressRing";
import { ProgressSettings } from "@/components/navigation/ProgressSettings";
import { GlowCard } from "@/components/ui/GlowCard";
import type { Difficulty, LessonMeta, Module } from "@/curriculum/types";
import type { LearningActivity } from "@/hooks/use-lesson-progress";
import { useHydrated } from "@/hooks/use-hydrated";
import {
  lessonFraction,
  sectionsDone,
  useLessonProgress,
  useTrackProgress,
} from "@/hooks/use-lesson-progress";
import { cn } from "@/lib/cn";
import { accentCssVar } from "@/lib/accent";
import { allLessons, getLesson, lessonPath, modules } from "@/lib/curriculum";
import { useProgress } from "@/stores/progress";
import { ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";

const difficultyColor: Record<Difficulty, string> = {
  foundational: "text-glow-green",
  intermediate: "text-glow-orange",
  advanced: "text-glow-violet",
};

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
 * am I in this lesson"; only this answers "how far through the track am I".
 */
export function TrackProgress() {
  // useTrackProgress is hydration-gated internally: pre-mount it reports the
  // logged-out snapshot (0 done / every section open), which is exactly the
  // markup the static HTML carries.
  const track = useTrackProgress();
  const pct = Math.round(track.fraction * 100);

  return (
    <GlowCard className="surface-card mb-10 px-5 py-4 sm:px-6">
      <div className="mb-3 flex items-baseline gap-3">
        <span className="tech-label">track progress</span>
        <div className="tech-rule min-w-6 flex-1" />
        <span className="tech-num text-2xl leading-none font-semibold text-accent">
          {pct}
          <span className="text-sm text-fg-faint">%</span>
        </span>
      </div>

      {/* section-weighted segments: each module's width is its share of the
          track's sections, so the bar and the numbers can't disagree */}
      <div className="mb-3 flex gap-1" aria-hidden>
        {track.segments.map((seg) => (
          <div
            key={seg.module.slug}
            className="h-1.5 overflow-hidden rounded-full bg-raised"
            style={{ flexGrow: seg.total || 1, flexBasis: 0 }}
          >
            <div
              className="h-full rounded-full transition-[width] duration-700 ease-[var(--ease-out-soft)]"
              style={{
                width: `${seg.fraction * 100}%`,
                background: accentCssVar[seg.module.accent],
                boxShadow:
                  seg.fraction > 0
                    ? `0 0 8px -1px ${accentCssVar[seg.module.accent]}`
                    : undefined,
              }}
            />
          </div>
        ))}
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
                background: accentCssVar[seg.module.accent],
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
 * Degrades in two steps: a finished lesson retargets to the next unfinished
 * one, and a finished track celebrates instead of pretending there's more.
 */
function ContinueCard() {
  const hydrated = useHydrated();
  const lastVisited = useProgress((s) => s.lastVisited);
  const completedSections = useProgress((s) => s.completedSections);

  if (!hydrated || !lastVisited) return null;

  const lesson = getLesson(lastVisited.lessonSlug);
  if (!lesson || lesson.status !== "available") return null;

  const done = sectionsDone(lesson, completedSections);
  const total = lesson.sections.length;

  if (done < total) {
    // Only deep-link to a section the registry still has; a renamed or
    // dropped id would scroll nowhere, so fall back to the lesson top.
    const section = lesson.sections.find(
      (sec) => sec.id === lastVisited.sectionId,
    );
    const href = section
      ? `${lessonPath(lesson)}#${section.id}`
      : lessonPath(lesson);

    return (
      <ResumeCard
        href={href}
        label="Continue where you left off"
        title={lesson.title}
        detail={section?.title}
        count={`${done}/${total}`}
      />
    );
  }

  // Finished the lesson they were last in — point at the next open one.
  const upNext = allLessons.find(
    (l) => l.status === "available" && lessonFraction(l, completedSections) < 1,
  );

  if (!upNext) {
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

  return (
    <ResumeCard
      href={lessonPath(upNext)}
      label="Up next"
      title={upNext.title}
      detail={upNext.tagline}
      count={`${sectionsDone(upNext, completedSections)}/${upNext.sections.length}`}
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
        <GlowCard active className="surface-card mb-12 flex items-center gap-4 px-5 py-4 sm:px-6">
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
  const soon = lesson.status === "coming-soon";

  const row = (
    <div
      className={cn(
        "flex-1 rounded-lg border border-border bg-raised px-4 py-4 shadow-[inset_0_1px_0_oklch(100%_0_0_/_35%)] transition-all",
        soon
          ? "opacity-40"
          : "group-hover:border-border-bright group-hover:bg-overlay group-hover:shadow-[0_1rem_2rem_-1.5rem_oklch(20%_0.01_180_/_22%)]",
      )}
    >
      <div className="mb-1 flex items-baseline gap-2.5">
        <span className="tech-num text-[11px] text-fg-faint">
          {String(index).padStart(2, "0")}
        </span>
        <h3 className="font-display text-base font-semibold">
          {lesson.title}
        </h3>
        {soon && (
          <span className="font-mono text-[9px] tracking-widest text-fg-faint uppercase">
            coming soon
          </span>
        )}
        {!soon && progress.activity !== "untouched" && (
          <span
            className={cn(
              "ml-auto font-mono text-[9px] tracking-widest uppercase",
              progress.activity === "mastered" ? "text-accent" : "text-fg-faint",
            )}
          >
            {activityLabel[progress.activity]}
          </span>
        )}
        {!soon && progress.activity === "untouched" && (
          <ArrowRight className="ml-auto size-3.5 shrink-0 text-fg-faint opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
        )}
      </div>
      <p className="mb-2 text-sm leading-relaxed text-fg-muted">
        {lesson.tagline}
      </p>
      <p className="font-mono text-[11px] tracking-wide text-fg-faint">
        <span className={difficultyColor[lesson.difficulty]}>
          {lesson.difficulty}
        </span>
        {" · "}
        {lesson.estimatedMinutes} min
        {lesson.prerequisites.length > 0 && (
          <span>
            {" · after "}
            {lesson.prerequisites
              .map((p) => getLesson(p)?.title ?? p)
              .join(", ")}
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
          accent={mod.accent}
        />
        <div className="mt-2 w-px flex-1 bg-border" />
      </div>
      {soon ? (
        <div className="flex flex-1">{row}</div>
      ) : (
        <Link href={lessonPath(lesson)} className="group flex flex-1">
          {row}
        </Link>
      )}
    </li>
  );
}

/** The learning-path map: module clusters on a progress spine. */
export function LessonMap() {
  return (
    <div className="relative">
      <div className="dot-grid dot-grid-fade pointer-events-none absolute inset-0 -z-10" />
      <ContinueCard />

      {modules.map((mod, i) => (
        // id + scroll-mt is a contract with the landing page, which links
        // straight to /learn#<module-slug>.
        <section key={mod.slug} id={mod.slug} className="mb-12 scroll-mt-24">
          <div className="section-heading mb-6">
            <span
              className="size-1.5 shrink-0 rounded-full"
              style={{
                background: accentCssVar[mod.accent],
                boxShadow: `0 0 8px ${accentCssVar[mod.accent]}`,
              }}
            />
            <span className="tech-num shrink-0 text-xs text-fg-faint">
              mod.{String(i + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0">
              <h2 className="font-display text-xl font-bold tracking-tight">{mod.title}</h2>
              <p className="mt-0.5 hidden text-xs text-fg-faint sm:block">{mod.description}</p>
            </div>
            <span className="tech-num ml-auto shrink-0 rounded-full border border-border bg-raised px-2.5 py-1 text-[10px] text-fg-faint">
              {mod.lessons.length} lessons
            </span>
          </div>

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
