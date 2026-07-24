"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

/** One in-sim PredictionQuiz checkpoint, keyed "<lessonSlug>/<quizId>". */
export interface QuizResult {
  /** The most recently chosen option id. */
  choiceId: string;
  /** Whether the FIRST attempt was right — never rewritten by retries. */
  correctFirstTry: boolean;
  attempts: number;
  completedAt: string; // ISO date
}

interface ProgressState {
  /** lesson slug → completed section ids (array for JSON serialization). */
  completedSections: Record<string, string[]>;
  /** "<lessonSlug>/<quizId>" → result. */
  quizAnswers: Record<string, QuizResult>;
  /** Powers the "continue where you left off" card. */
  lastVisited: { lessonSlug: string; sectionId: string } | null;

  completeSection: (lessonSlug: string, sectionId: string) => void;
  recordQuiz: (key: string, choiceId: string, correct: boolean) => void;
  setLastVisited: (lessonSlug: string, sectionId: string) => void;
  resetLesson: (lessonSlug: string) => void;
  resetAll: () => void;
}

/** The persisted slice — what `partialize` writes and `migrate` returns. */
type PersistedProgress = Pick<
  ProgressState,
  "completedSections" | "quizAnswers" | "lastVisited"
>;

const emptyProgress = (): PersistedProgress => ({
  completedSections: {},
  quizAnswers: {},
  lastVisited: null,
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeQuizResult(value: unknown): QuizResult | null {
  if (!isRecord(value)) return null;
  const { choiceId, correctFirstTry, attempts, completedAt } = value;
  if (
    typeof choiceId !== "string" ||
    typeof correctFirstTry !== "boolean" ||
    typeof attempts !== "number" ||
    !Number.isFinite(attempts) ||
    typeof completedAt !== "string"
  ) {
    return null;
  }
  return { choiceId, correctFirstTry, attempts, completedAt };
}

/**
 * localStorage is user-writable and older builds wrote other shapes, so every
 * field is re-validated on the way in; anything unrecognizable is dropped
 * rather than handed to progress math that assumes arrays.
 */
export function sanitizeProgress(raw: unknown): PersistedProgress {
  if (!isRecord(raw)) return emptyProgress();

  const completedSections: Record<string, string[]> = {};
  if (isRecord(raw.completedSections)) {
    for (const [slug, ids] of Object.entries(raw.completedSections)) {
      if (!Array.isArray(ids)) continue;
      const clean = ids.filter((id): id is string => typeof id === "string");
      if (clean.length > 0) completedSections[slug] = clean;
    }
  }

  const quizAnswers: Record<string, QuizResult> = {};
  if (isRecord(raw.quizAnswers)) {
    for (const [key, result] of Object.entries(raw.quizAnswers)) {
      const clean = sanitizeQuizResult(result);
      if (clean) quizAnswers[key] = clean;
    }
  }

  const visited = raw.lastVisited;
  const lastVisited =
    isRecord(visited) &&
    typeof visited.lessonSlug === "string" &&
    typeof visited.sectionId === "string"
      ? { lessonSlug: visited.lessonSlug, sectionId: visited.sectionId }
      : null;

  return { completedSections, quizAnswers, lastVisited };
}

/** Quiz storage key — quiz ids are only unique within a lesson. */
export const quizKey = (lessonSlug: string, quizId: string) =>
  `${lessonSlug}/${quizId}`;

export const useProgress = create<ProgressState>()(
  persist(
    (set) => ({
      ...emptyProgress(),

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

      recordQuiz: (key, choiceId, correct) =>
        set((s) => {
          const prev = s.quizAnswers[key];
          const result: QuizResult = {
            choiceId,
            // First answer decides this forever — retries can't launder it.
            correctFirstTry: prev ? prev.correctFirstTry : correct,
            attempts: prev ? prev.attempts + 1 : 1,
            completedAt: new Date().toISOString(),
          };
          return { quizAnswers: { ...s.quizAnswers, [key]: result } };
        }),

      setLastVisited: (lessonSlug, sectionId) =>
        set({ lastVisited: { lessonSlug, sectionId } }),

      resetLesson: (lessonSlug) =>
        set((s) => {
          const completedSections = { ...s.completedSections };
          delete completedSections[lessonSlug];
          const prefix = `${lessonSlug}/`;
          const quizAnswers = Object.fromEntries(
            Object.entries(s.quizAnswers).filter(
              ([key]) => !key.startsWith(prefix),
            ),
          );
          return {
            completedSections,
            quizAnswers,
            lastVisited:
              s.lastVisited?.lessonSlug === lessonSlug ? null : s.lastVisited,
          };
        }),

      resetAll: () => set(emptyProgress()),
    }),
    {
      name: "softeng-progress",
      version: 2,
      migrate: (state) => sanitizeProgress(state),
      merge: (persisted, current) => ({
        ...current,
        ...sanitizeProgress(persisted),
      }),
      partialize: (s) => ({
        completedSections: s.completedSections,
        quizAnswers: s.quizAnswers,
        lastVisited: s.lastVisited,
      }),
    },
  ),
);
