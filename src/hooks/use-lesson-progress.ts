"use client";

import type { LessonMeta, Module } from "@/curriculum/types";
import { useHydrated } from "@/hooks/use-hydrated";
import { useProgress } from "@/stores/progress";

export type LessonState = "untouched" | "in-progress" | "complete";

export interface LessonProgress {
  /** 0..1 — completed registry sections / total registry sections. */
  fraction: number;
  state: LessonState;
}

/**
 * Derived progress for one lesson. Denominator comes from the registry's
 * section list, so it's computable without rendering the lesson.
 * Returns neutral (0) until hydration to avoid SSG mismatches.
 */
export function useLessonProgress(lesson: LessonMeta): LessonProgress {
  const hydrated = useHydrated();
  const completed = useProgress((s) => s.completedSections[lesson.slug]);

  if (!hydrated || !completed?.length) {
    return { fraction: 0, state: "untouched" };
  }

  const valid = new Set(lesson.sections.map((sec) => sec.id));
  const done = completed.filter((id) => valid.has(id)).length;
  const fraction = Math.min(done / lesson.sections.length, 1);

  return {
    fraction,
    state: fraction >= 1 ? "complete" : "in-progress",
  };
}

/** Average lesson fraction across a module (available lessons only). */
export function useModuleProgress(module: Module): number {
  const hydrated = useHydrated();
  const completedSections = useProgress((s) => s.completedSections);

  if (!hydrated) return 0;
  const lessons = module.lessons.filter((l) => l.status === "available");
  if (lessons.length === 0) return 0;

  const total = lessons.reduce((acc, lesson) => {
    const valid = new Set(lesson.sections.map((sec) => sec.id));
    const done = (completedSections[lesson.slug] ?? []).filter((id) =>
      valid.has(id),
    ).length;
    return acc + Math.min(done / lesson.sections.length, 1);
  }, 0);

  return total / lessons.length;
}
