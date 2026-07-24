"use client";

import type { LessonMeta } from "@/curriculum/types";
import { createContext, useContext } from "react";

/** Provided by <Lesson>, consumed by sections and embedded widgets. */
export const LessonContext = createContext<LessonMeta | null>(null);

export function useLessonMeta(): LessonMeta {
  const meta = useContext(LessonContext);
  if (!meta) throw new Error("useLessonMeta must be used inside <Lesson>");
  return meta;
}

/**
 * Provided by <LessonSection>; interactive/quiz widgets call it to mark
 * their section complete (progress is interaction-gated on this site).
 */
export const SectionCompletionContext = createContext<() => void>(() => {});

export function useSectionCompletion(): () => void {
  return useContext(SectionCompletionContext);
}
