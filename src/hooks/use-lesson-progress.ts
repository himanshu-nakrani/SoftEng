"use client";

import type { LessonMeta, Module } from "@/curriculum/types";
import { useHydrated } from "@/hooks/use-hydrated";
import { modules } from "@/lib/curriculum";
import { useProgress, type QuizResult } from "@/stores/progress";
import { useMemo } from "react";

export type LessonState = "untouched" | "in-progress" | "complete";
export type LearningActivity = "untouched" | "explored" | "predicted" | "complete" | "mastered";

export interface LessonProgress {
  /** 0..1 — completed registry sections / total registry sections. */
  fraction: number;
  state: LessonState;
  /** A learner-facing state that distinguishes exploration from prediction. */
  activity: LearningActivity;
  /** Completed / total registry sections — the "2/4" readout. */
  done: number;
  total: number;
  /** Number of persisted prediction checkpoints attempted in this lesson. */
  quizzesAttempted: number;
  /**
   * Every section done AND every recorded checkpoint right first try.
   * Deliberately a flag layered on `state` rather than a fourth
   * `LessonState`: surfaces that only care about ring geometry (sidebar,
   * mobile nav) keep working against the three-value union unchanged.
   */
  mastered: boolean;
}

/** Stable empty references so pre-hydration renders don't thrash memos. */
const EMPTY_SECTIONS: Record<string, string[]> = {};
const EMPTY_QUIZZES: Record<string, QuizResult> = {};

/* ---------------------------------------------------------------------------
   Pure helpers — no hooks, so hooks, components and one-off math can share
   exactly one definition of "done" and "mastered".
--------------------------------------------------------------------------- */

/** Completed sections for a lesson, ignoring ids the registry dropped. */
export function sectionsDone(
  lesson: LessonMeta,
  completedSections: Record<string, string[]>,
): number {
  const valid = new Set(lesson.sections.map((sec) => sec.id));
  const completed = completedSections[lesson.slug] ?? [];
  return completed.filter((id) => valid.has(id)).length;
}

export function lessonFraction(
  lesson: LessonMeta,
  completedSections: Record<string, string[]>,
): number {
  if (lesson.sections.length === 0) return 0;
  return Math.min(sectionsDone(lesson, completedSections) / lesson.sections.length, 1);
}

/**
 * Mastery = 100% of sections AND a clean sheet on every checkpoint this
 * lesson has actually recorded.
 *
 * The lesson's quiz list is derived from the persisted keys prefixed
 * "<slug>/" rather than from the registry (which does not carry quiz ids —
 * they live on the `LessonSim`). Consequence, and it is the intended one: a
 * lesson with zero recorded quizzes is merely `complete`, never mastered, so
 * mastery can only be claimed by having answered something.
 */
export function lessonQuizCount(
  lesson: LessonMeta,
  quizAnswers: Record<string, QuizResult>,
): number {
  const prefix = `${lesson.slug}/`;
  return Object.keys(quizAnswers).filter((key) => key.startsWith(prefix)).length;
}

export function lessonMastered(
  lesson: LessonMeta,
  completedSections: Record<string, string[]>,
  quizAnswers: Record<string, QuizResult>,
): boolean {
  if (lessonFraction(lesson, completedSections) < 1) return false;

  const prefix = `${lesson.slug}/`;
  let recorded = 0;
  for (const [key, result] of Object.entries(quizAnswers)) {
    if (!key.startsWith(prefix)) continue;
    if (!result.correctFirstTry) return false;
    recorded += 1;
  }
  return recorded > 0;
}

/* ---------------------------------------------------------------------------
   Hooks — every one returns the logged-out default until hydration, because
   the static HTML is rendered without localStorage.
--------------------------------------------------------------------------- */

/**
 * Derived progress for one lesson. Denominator comes from the registry's
 * section list, so it's computable without rendering the lesson.
 * Returns neutral (0) until hydration to avoid SSG mismatches.
 */
export function useLessonProgress(lesson: LessonMeta): LessonProgress {
  const hydrated = useHydrated();
  const completedSections = useProgress((s) => s.completedSections);
  const quizAnswers = useProgress((s) => s.quizAnswers);

  const total = lesson.sections.length;
  if (!hydrated) {
    return {
      fraction: 0,
      state: "untouched",
      activity: "untouched",
      done: 0,
      total,
      quizzesAttempted: 0,
      mastered: false,
    };
  }

  const done = sectionsDone(lesson, completedSections);
  const fraction = total === 0 ? 0 : Math.min(done / total, 1);
  const quizzesAttempted = lessonQuizCount(lesson, quizAnswers);
  const mastered = lessonMastered(lesson, completedSections, quizAnswers);
  const activity = mastered
    ? "mastered"
    : fraction >= 1
      ? "complete"
      : quizzesAttempted > 0
        ? "predicted"
        : done > 0
          ? "explored"
          : "untouched";

  return {
    fraction,
    state: fraction >= 1 ? "complete" : done > 0 ? "in-progress" : "untouched",
    activity,
    done,
    total,
    quizzesAttempted,
    mastered,
  };
}

/** Average lesson fraction across a module (available lessons only). */
export function useModuleProgress(module: Module): number {
  const hydrated = useHydrated();
  const completedSections = useProgress((s) => s.completedSections);

  if (!hydrated) return 0;
  const lessons = module.lessons.filter((l) => l.status === "available");
  if (lessons.length === 0) return 0;

  const total = lessons.reduce(
    (acc, lesson) => acc + lessonFraction(lesson, completedSections),
    0,
  );

  return total / lessons.length;
}

export interface SegmentProgress {
  module: Module;
  /** Completed / total registry sections across the module's live lessons. */
  done: number;
  total: number;
  fraction: number;
  lessons: number;
  lessonsComplete: number;
  lessonsExplored: number;
  lessonsPredicted: number;
}

export interface TrackProgress {
  done: number;
  total: number;
  fraction: number;
  lessons: number;
  lessonsComplete: number;
  lessonsExplored: number;
  lessonsPredicted: number;
  lessonsMastered: number;
  segments: SegmentProgress[];
}

/**
 * Track-wide progress, weighted by registry SECTIONS rather than by lesson
 * (a 5-section lesson is more of the track than a 3-section one), so the
 * headline % and the "N sections still open" copy always agree.
 *
 * `coming-soon` lessons are excluded from both numerator and denominator —
 * they have no route, so counting them would make 100% unreachable.
 */
export function useTrackProgress(): TrackProgress {
  const hydrated = useHydrated();
  const completedSections = useProgress((s) => s.completedSections);
  const quizAnswers = useProgress((s) => s.quizAnswers);

  // Pre-hydration: the logged-out snapshot — every section still open.
  const sections = hydrated ? completedSections : EMPTY_SECTIONS;
  const quizzes = hydrated ? quizAnswers : EMPTY_QUIZZES;

  return useMemo(() => {
    const segments: SegmentProgress[] = modules.map((module) => {
      const live = module.lessons.filter((l) => l.status === "available");
      let done = 0;
      let total = 0;
      let lessonsComplete = 0;
      let lessonsExplored = 0;
      let lessonsPredicted = 0;
      for (const lesson of live) {
        done += sectionsDone(lesson, sections);
        total += lesson.sections.length;
        if (lessonFraction(lesson, sections) >= 1) lessonsComplete += 1;
        if (sectionsDone(lesson, sections) > 0) lessonsExplored += 1;
        if (lessonQuizCount(lesson, quizzes) > 0) lessonsPredicted += 1;
      }
      return {
        module,
        done,
        total,
        fraction: total === 0 ? 0 : Math.min(done / total, 1),
        lessons: live.length,
        lessonsComplete,
        lessonsExplored,
        lessonsPredicted,
      };
    });

    const done = segments.reduce((acc, seg) => acc + seg.done, 0);
    const total = segments.reduce((acc, seg) => acc + seg.total, 0);
    const lessonsMastered = modules
      .flatMap((m) => m.lessons)
      .filter(
        (lesson) =>
          lesson.status === "available" &&
          lessonMastered(lesson, sections, quizzes),
      ).length;

    return {
      done,
      total,
      fraction: total === 0 ? 0 : Math.min(done / total, 1),
      lessons: segments.reduce((acc, seg) => acc + seg.lessons, 0),
      lessonsComplete: segments.reduce(
        (acc, seg) => acc + seg.lessonsComplete,
        0,
      ),
      lessonsExplored: segments.reduce(
        (acc, seg) => acc + seg.lessonsExplored,
        0,
      ),
      lessonsPredicted: segments.reduce(
        (acc, seg) => acc + seg.lessonsPredicted,
        0,
      ),
      lessonsMastered,
      segments,
    };
  }, [sections, quizzes]);
}
