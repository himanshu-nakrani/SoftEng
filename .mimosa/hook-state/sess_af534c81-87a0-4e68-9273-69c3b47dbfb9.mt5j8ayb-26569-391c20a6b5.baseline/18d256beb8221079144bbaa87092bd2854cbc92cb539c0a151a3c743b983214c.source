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
  /**
   * Folds an exported (or hand-edited) payload into the live progress.
   * Never destructive — see `mergeProgress` for the keep-best rules — so a
   * mistaken import can't wipe work that only exists on this device.
   */
  importProgress: (raw: unknown) => ImportSummary;
}

/** The persisted slice — what `partialize` writes and `migrate` returns. */
export type PersistedProgress = Pick<
  ProgressState,
  "completedSections" | "quizAnswers" | "lastVisited"
>;

/** Persisted-shape version — shared by the store and the export envelope. */
export const PROGRESS_VERSION = 2;

/** Download/upload envelope. `state` is exactly the persisted slice. */
export interface ProgressExport {
  app: "syslab";
  version: number;
  exportedAt: string; // ISO date
  state: PersistedProgress;
}

/** What an import actually changed — the settings UI reports this verbatim. */
export interface ImportSummary {
  /** Lesson slugs the incoming file had anything to say about. */
  lessons: number;
  sectionsAdded: number;
  quizzesAdded: number;
  /** Existing quiz records the incoming one beat (see `betterQuiz`). */
  quizzesUpdated: number;
}

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

/** Wraps the persisted slice for download. */
export function buildProgressExport(state: PersistedProgress): ProgressExport {
  return {
    app: "syslab",
    version: PROGRESS_VERSION,
    exportedAt: new Date().toISOString(),
    state: {
      completedSections: state.completedSections,
      quizAnswers: state.quizAnswers,
      lastVisited: state.lastVisited,
    },
  };
}

/**
 * Unwraps an uploaded file: accepts the full envelope, a bare persisted slice
 * (hand-edited files, or a raw copy of the localStorage value), and rejects
 * everything else by sanitizing it down to empty progress — so a wrong file
 * imports as "0 changes" rather than throwing or corrupting the store.
 */
export function readProgressExport(raw: unknown): PersistedProgress {
  if (isRecord(raw) && isRecord(raw.state)) return sanitizeProgress(raw.state);
  return sanitizeProgress(raw);
}

/** True when nothing is tracked — used to disable export/reset affordances. */
export function isEmptyProgress(state: PersistedProgress): boolean {
  return (
    Object.keys(state.completedSections).length === 0 &&
    Object.keys(state.quizAnswers).length === 0
  );
}

/**
 * Keep-best for one quiz checkpoint: a first-try-correct record always wins
 * (it is the fact the mastery tier is built on and can never be re-earned),
 * otherwise the record with more attempts is the more complete history.
 */
function betterQuiz(mine: QuizResult, theirs: QuizResult): QuizResult {
  if (mine.correctFirstTry !== theirs.correctFirstTry) {
    return mine.correctFirstTry ? mine : theirs;
  }
  return theirs.attempts > mine.attempts ? theirs : mine;
}

/**
 * Non-destructive union of two progress snapshots:
 *  - completedSections: set union per lesson (a section can't un-complete)
 *  - quizAnswers: keep-best per key
 *  - lastVisited: the incoming pointer when it has one. There is no timestamp
 *    on lastVisited to compare, and an import is an explicit "continue from
 *    this snapshot" gesture, so incoming wins; an import without one leaves
 *    the local pointer alone.
 */
export function mergeProgress(
  base: PersistedProgress,
  incoming: PersistedProgress,
): { next: PersistedProgress; summary: ImportSummary } {
  const completedSections: Record<string, string[]> = {
    ...base.completedSections,
  };
  let sectionsAdded = 0;
  for (const [slug, ids] of Object.entries(incoming.completedSections)) {
    const existing = completedSections[slug] ?? [];
    const merged = [...existing];
    for (const id of ids) {
      if (!merged.includes(id)) {
        merged.push(id);
        sectionsAdded += 1;
      }
    }
    completedSections[slug] = merged;
  }

  const quizAnswers: Record<string, QuizResult> = { ...base.quizAnswers };
  let quizzesAdded = 0;
  let quizzesUpdated = 0;
  for (const [key, theirs] of Object.entries(incoming.quizAnswers)) {
    const mine = quizAnswers[key];
    if (!mine) {
      quizAnswers[key] = theirs;
      quizzesAdded += 1;
      continue;
    }
    const best = betterQuiz(mine, theirs);
    if (best !== mine) {
      quizAnswers[key] = best;
      quizzesUpdated += 1;
    }
  }

  const touched = new Set<string>(Object.keys(incoming.completedSections));
  for (const key of Object.keys(incoming.quizAnswers)) {
    touched.add(key.slice(0, key.indexOf("/")));
  }

  return {
    next: {
      completedSections,
      quizAnswers,
      lastVisited: incoming.lastVisited ?? base.lastVisited,
    },
    summary: {
      lessons: touched.size,
      sectionsAdded,
      quizzesAdded,
      quizzesUpdated,
    },
  };
}

export const useProgress = create<ProgressState>()(
  persist(
    (set, get) => ({
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

      importProgress: (raw) => {
        const { completedSections, quizAnswers, lastVisited } = get();
        const { next, summary } = mergeProgress(
          { completedSections, quizAnswers, lastVisited },
          readProgressExport(raw),
        );
        set(next);
        return summary;
      },
    }),
    {
      name: "softeng-progress",
      version: PROGRESS_VERSION,
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
