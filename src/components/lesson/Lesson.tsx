"use client";

import type { Difficulty, LessonMeta } from "@/curriculum/types";
import { useHydrated } from "@/hooks/use-hydrated";
import { useLessonKeyboardNav } from "@/hooks/use-lesson-keyboard-nav";
import { useLessonProgress } from "@/hooks/use-lesson-progress";
import { cn } from "@/lib/cn";
import { getLesson, moduleOf } from "@/lib/curriculum";
import { useProgress } from "@/stores/progress";
import { BookOpen, Focus, Sparkles } from "lucide-react";
import { useCallback, useState, type ReactNode } from "react";
import {
  LessonCompletionContext,
  LessonContext,
  LessonUiContext,
} from "./context";
import { LearningConnections } from "./LearningConnections";
import { ReflectionCard } from "./ReflectionCard";
import { LearningSummary } from "./LearningSummary";
import { NextLessonCard } from "./NextLessonCard";

const difficultyColor: Record<Difficulty, string> = {
  foundational: "text-glow-green",
  intermediate: "text-glow-orange",
  advanced: "text-glow-violet",
};

/** Fixed right-rail mini-TOC with live checkpoint dots (xl screens). */
function CheckpointRail({ slug }: { slug: string }) {
  const meta = getLesson(slug)!;
  const hydrated = useHydrated();
  const completed = useProgress((s) => s.completedSections[slug]);
  const done = new Set(hydrated ? (completed ?? []) : []);

  return (
    <nav
      aria-label="Lesson sections"
      className="fixed top-1/2 right-6 hidden -translate-y-1/2 flex-col gap-1 xl:flex"
    >
      {meta.sections.map((section) => {
        const isDone = done.has(section.id);
        return (
          <a
            key={section.id}
            href={`#${section.id}`}
            className="group flex items-center justify-end gap-2 py-1"
          >
            <span className="font-mono text-[10px] text-fg-faint opacity-0 transition-opacity group-hover:opacity-100">
              {section.title}
            </span>
            <span
              className={cn(
                "size-2 rounded-full transition-all",
                isDone
                  ? "bg-glow-green shadow-[0_0_6px_var(--color-glow-green)]"
                  : "border border-border-bright bg-transparent group-hover:border-fg-muted",
              )}
            />
          </a>
        );
      })}
    </nav>
  );
}

/**
 * Mastery mark for the lesson header row: shown only when every section is
 * done AND every checkpoint here was right first try. Own component so the
 * store read stays out of the page-level render and stays hydration-gated
 * (`useLessonProgress` returns the logged-out default until mount).
 */
function MasteryMark({ meta }: { meta: LessonMeta }) {
  const { mastered } = useLessonProgress(meta);
  if (!mastered) return null;

  return (
    <span
      className="inline-flex items-center gap-1 font-mono text-[10px] tracking-widest text-accent uppercase"
      title="Mastered — every checkpoint right first try"
    >
      <Sparkles className="size-3" strokeWidth={2} />
      mastered
    </span>
  );
}

const activityCopy = {
  untouched: "not started",
  explored: "explored",
  predicted: "predicted",
  complete: "complete",
  mastered: "mastered",
} as const;

function LessonProgressStrip({ meta }: { meta: LessonMeta }) {
  const hydrated = useHydrated();
  const completed = useProgress((s) => s.completedSections[meta.slug]);
  const progress = useLessonProgress(meta);
  const done = new Set(hydrated ? (completed ?? []) : []);
  const nextSection = meta.sections.find((section) => !done.has(section.id));

  return (
    <div
      className="mt-5 rounded-lg border border-border bg-bg/25 px-3.5 py-3"
      aria-label={`Lesson progress: ${progress.done} of ${progress.total} sections, ${activityCopy[progress.activity]}`}
    >
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] tracking-widest text-fg-faint uppercase">
        <span className="inline-flex items-center gap-1.5 text-fg-muted">
          <BookOpen className="size-3.5 text-accent" strokeWidth={1.75} />
          learning state
        </span>
        <span className="text-accent">{activityCopy[progress.activity]}</span>
        <span className="ml-auto text-fg-faint">
          {progress.done}/{progress.total} sections
          {progress.quizzesAttempted > 0 &&
            ` · ${progress.quizzesAttempted} prediction${progress.quizzesAttempted === 1 ? "" : "s"}`}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-raised" aria-hidden>
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-500 ease-[var(--ease-out-soft)]"
          style={{ width: `${progress.fraction * 100}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-fg-muted">
        {nextSection ? (
          <>
            <span className="font-medium text-fg">Next:</span> {nextSection.title}
          </>
        ) : (
          <>
            <span className="font-medium text-fg">All sections visited.</span>{" "}
            Revisit a causal state or open the review deck.
          </>
        )}
      </p>
    </div>
  );
}

interface LessonProps {
  slug: string;
  children: ReactNode;
}

/**
 * Lesson page chrome: ghost-index header, mono spec row, checkpoint rail,
 * sections, next-lesson card. Meta comes from the curriculum registry —
 * pages never restate it.
 */
export function Lesson({ slug, children }: LessonProps) {
  const [calibration, setCalibration] = useState(false);
  const completeSection = useProgress((s) => s.completeSection);
  const completeLessonSection = useCallback(
    (sectionId: string) => completeSection(slug, sectionId),
    [completeSection, slug],
  );
  // `[` / `]` walk the curriculum; the bottom card shows the same two moves.
  useLessonKeyboardNav(slug);

  const meta = getLesson(slug);
  if (!meta) {
    throw new Error(`Lesson "${slug}" is not in curriculum/registry.ts`);
  }
  const mod = moduleOf(meta);
  const index = mod.lessons.findIndex((l) => l.slug === slug) + 1;
  const nn = String(index).padStart(2, "0");

  return (
    <LessonContext.Provider value={meta}>
      <LessonUiContext.Provider value={{ calibration, setCalibration }}>
        <LessonCompletionContext.Provider value={completeLessonSection}>
          <article data-calibration={calibration ? "true" : undefined}>
          <header className="surface-card relative mb-14 overflow-hidden px-5 py-6 sm:px-8 sm:py-8">
            {/* ghost index numeral */}
            <span
              aria-hidden
              className="font-display pointer-events-none absolute -top-6 -left-1 text-[8rem] leading-none font-bold text-accent/[0.06] select-none"
            >
              {nn}
            </span>

            <div className="relative">
              <div className="mb-5 flex items-center gap-3">
                <span className="tech-label text-glow-red">live thought experiment</span>
                <span className="hidden text-fg-faint sm:inline">/</span>
                <span className="tech-label hidden sm:inline">{mod.title}</span>
                <div className="tech-rule flex-1" />
                <MasteryMark meta={meta} />
                <span className="tech-num text-xs text-fg-faint">
                  {nn} / {String(mod.lessons.length).padStart(2, "0")}
                </span>
              </div>

              <h1 className="hero-copy font-display mb-3 text-3xl font-bold tracking-tight sm:text-4xl">
                {meta.title}
              </h1>
              <p className="mb-6 max-w-2xl leading-relaxed text-fg-muted">
                {meta.tagline}
              </p>

              {/* spec row — engineering drawing title block, not pill badges */}
              <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 border-y border-border py-2.5 font-mono text-[11px] tracking-wide text-fg-faint uppercase">
                <span>
                  difficulty{" "}
                  <span className={difficultyColor[meta.difficulty]}>
                    {meta.difficulty}
                  </span>
                </span>
                <span>
                  est <span className="text-fg-muted">{meta.estimatedMinutes} min</span>
                </span>
                {meta.prerequisites.length > 0 && (
                  <span>
                    after{" "}
                    <span className="text-fg-muted normal-case">
                      {meta.prerequisites
                        .map((p) => getLesson(p)?.title ?? p)
                        .join(", ")}
                    </span>
                  </span>
                )}
              </div>

              <LessonProgressStrip meta={meta} />

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="calibration-secondary text-xs text-fg-faint">
                  Read the causal story first, then restore the full instrument.
                </p>
                <button
                  type="button"
                  aria-pressed={calibration}
                  aria-label={calibration ? "Return to experiment mode" : "Enter reading mode"}
                  onClick={() => setCalibration((value) => !value)}
                  className="inline-flex min-h-8 items-center gap-2 rounded-lg border border-border bg-raised px-3 py-1.5 font-mono text-[10px] tracking-widest text-fg-muted uppercase transition-colors hover:border-border-bright hover:bg-surface hover:text-fg"
                >
                  <Focus className="size-3.5 text-accent" strokeWidth={1.75} />
                  {calibration ? "Return to experiment" : "Reading mode"}
                </button>
              </div>
            </div>
          </header>

          <CheckpointRail slug={slug} />
          {children}
          <LearningSummary meta={meta} />
          <ReflectionCard meta={meta} />
          <LearningConnections meta={meta} />
          <NextLessonCard />
          </article>
        </LessonCompletionContext.Provider>
      </LessonUiContext.Provider>
    </LessonContext.Provider>
  );
}
