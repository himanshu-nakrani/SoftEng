import type { LessonMeta } from "@/curriculum/types";
import {
  lessonFraction,
  lessonMastered,
  lessonQuizCount,
  sectionsDone,
} from "@/hooks/use-lesson-progress";
import type { QuizResult } from "@/stores/progress";
import { describe, expect, it } from "vitest";

/**
 * The pure progress math.
 *
 * `learning.test.ts` touches `lessonMastered` and `lessonQuizCount` in passing
 * while checking guides; nothing covered the edges, and these four functions
 * decide every ring, percentage and mastery badge in the app. They are also the
 * functions that have to survive a registry edit: a renamed or dropped section id
 * must not inflate a percentage or strand a lesson at 99%.
 *
 * Fixtures are hand-built rather than taken from the real registry, so a
 * curriculum change cannot quietly alter what these assert.
 */

const lesson = (sectionIds: string[]): LessonMeta => ({
  slug: "fixture",
  moduleSlug: "fixtures",
  title: "Fixture",
  tagline: "—",
  difficulty: "intermediate",
  estimatedMinutes: 10,
  prerequisites: [],
  status: "available",
  sections: sectionIds.map((id) => ({ id, title: id, kind: "concept" })),
});

const answer = (over: Partial<QuizResult> = {}): QuizResult => ({
  choiceId: "a",
  correctFirstTry: true,
  attempts: 1,
  completedAt: "2026-01-01T00:00:00.000Z",
  ...over,
});

const THREE = lesson(["a", "b", "c"]);

describe("sectionsDone: only counts ids the registry still has", () => {
  it("counts nothing when the lesson has no record", () => {
    expect(sectionsDone(THREE, {})).toBe(0);
  });

  it("ignores a stored id the registry dropped or renamed", () => {
    // The important case: a section removed from the registry must not keep
    // counting, or a two-section lesson reads 3/2.
    expect(sectionsDone(THREE, { fixture: ["a", "removed-in-a-refactor"] })).toBe(1);
  });

  it("does not double-count a duplicated id", () => {
    expect(sectionsDone(THREE, { fixture: ["a", "a", "b"] })).toBe(2);
  });
});

describe("lessonFraction: never exceeds 1, never divides by zero", () => {
  it("is 0 for a lesson with no sections rather than NaN", () => {
    expect(lessonFraction(lesson([]), { fixture: ["a"] })).toBe(0);
  });

  it("clamps at 1 even if extra valid-looking ids appear", () => {
    expect(lessonFraction(THREE, { fixture: ["a", "b", "c"] })).toBe(1);
    expect(lessonFraction(THREE, { fixture: ["a", "a", "b", "b", "c", "c"] })).toBe(1);
  });

  it("reports a partial fraction exactly", () => {
    expect(lessonFraction(THREE, { fixture: ["a"] })).toBeCloseTo(1 / 3);
  });
});

describe("lessonQuizCount: keys are lesson-scoped", () => {
  it("counts only this lesson's checkpoints", () => {
    const answers = {
      "fixture/q1": answer(),
      "fixture/q2": answer(),
      "other-lesson/q1": answer(),
    };
    expect(lessonQuizCount(THREE, answers)).toBe(2);
  });

  it("is not fooled by a slug that merely starts the same", () => {
    // "fixture-two/q1" must not count toward "fixture", which a naive
    // startsWith(slug) rather than startsWith(`${slug}/`) would get wrong.
    expect(lessonQuizCount(THREE, { "fixture-two/q1": answer() })).toBe(0);
  });
});

describe("lessonMastered: complete AND clean, and never by default", () => {
  const allDone = { fixture: ["a", "b", "c"] };

  it("is false when sections remain, however good the answers", () => {
    expect(lessonMastered(THREE, { fixture: ["a"] }, { "fixture/q1": answer() })).toBe(
      false,
    );
  });

  it("is false for a complete lesson with no recorded checkpoints", () => {
    // Deliberate: mastery must be earned by answering something, so a
    // quiz-less lesson is `complete`, never `mastered`.
    expect(lessonMastered(THREE, allDone, {})).toBe(false);
  });

  it("is true only when every recorded checkpoint was right first try", () => {
    expect(
      lessonMastered(THREE, allDone, {
        "fixture/q1": answer(),
        "fixture/q2": answer(),
      }),
    ).toBe(true);

    expect(
      lessonMastered(THREE, allDone, {
        "fixture/q1": answer(),
        "fixture/q2": answer({ correctFirstTry: false }),
      }),
    ).toBe(false);
  });

  it("ignores another lesson's failed checkpoint", () => {
    expect(
      lessonMastered(THREE, allDone, {
        "fixture/q1": answer(),
        "other-lesson/q1": answer({ correctFirstTry: false }),
      }),
    ).toBe(true);
  });

  it("still requires a clean sheet when the answer took several attempts", () => {
    // correctFirstTry is the only thing that matters; attempts is history.
    expect(
      lessonMastered(THREE, allDone, {
        "fixture/q1": answer({ attempts: 4 }),
      }),
    ).toBe(true);
  });
});
