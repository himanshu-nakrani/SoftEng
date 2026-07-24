"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface QuizResult {
  /** Chosen option index per question. */
  answers: number[];
  /** 0..1 */
  score: number;
  completedAt: string; // ISO date
}

interface ProgressState {
  /** lesson slug → completed section ids (array for JSON serialization). */
  completedSections: Record<string, string[]>;
  /** quiz id → result. */
  quizAnswers: Record<string, QuizResult>;
  /** Powers the "continue where you left off" card. */
  lastVisited: { lessonSlug: string; sectionId: string } | null;

  completeSection: (lessonSlug: string, sectionId: string) => void;
  recordQuiz: (quizId: string, result: QuizResult) => void;
  setLastVisited: (lessonSlug: string, sectionId: string) => void;
  resetLesson: (lessonSlug: string) => void;
}

export const useProgress = create<ProgressState>()(
  persist(
    (set) => ({
      completedSections: {},
      quizAnswers: {},
      lastVisited: null,

      completeSection: (lessonSlug, sectionId) =>
        set((s) => {
          const existing = s.completedSections[lessonSlug] ?? [];
          if (existing.includes(sectionId)) return s;
          return {
            completedSections: {
              ...s.completedSections,
              [lessonSlug]: [...existing, sectionId],
            },
          };
        }),

      recordQuiz: (quizId, result) =>
        set((s) => ({ quizAnswers: { ...s.quizAnswers, [quizId]: result } })),

      setLastVisited: (lessonSlug, sectionId) =>
        set({ lastVisited: { lessonSlug, sectionId } }),

      resetLesson: (lessonSlug) =>
        set((s) => {
          const completedSections = { ...s.completedSections };
          delete completedSections[lessonSlug];
          return { completedSections };
        }),
    }),
    {
      name: "softeng-progress",
      version: 1,
      // Schema will evolve as lessons ship; bump version + migrate here.
      migrate: (state) => state as ProgressState,
      partialize: (s) => ({
        completedSections: s.completedSections,
        quizAnswers: s.quizAnswers,
        lastVisited: s.lastVisited,
      }),
    },
  ),
);
