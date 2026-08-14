import { describe, expect, it } from "vitest";
import { allLessons } from "@/lib/curriculum";
import { getLearningGuide, learningLinks, validateLearningGuides } from "../learning";
import { lessonQuizCount, lessonMastered } from "@/hooks/use-lesson-progress";

describe("learning guides", () => {
  it("covers every available lesson and only links to registered lessons", () => {
    expect(validateLearningGuides()).toEqual([]);
    expect(Object.keys(allLessons).length).toBeGreaterThan(0);
    for (const lesson of allLessons) {
      const guide = getLearningGuide(lesson.slug);
      expect(guide.question.length).toBeGreaterThan(20);
      expect(guide.changed.length).toBeGreaterThan(20);
      expect(guide.why.length).toBeGreaterThan(20);
      expect(guide.tryNext.length).toBeGreaterThan(20);
      expect(learningLinks(lesson.slug).every((link) => link.href.startsWith("/learn/"))).toBe(true);
    }
  });

  it("keeps quiz activity separate from section completion and mastery", () => {
    const lesson = allLessons[0];
    const quizAnswers = {
      [`${lesson.slug}/checkpoint`]: {
        choiceId: "a",
        correctFirstTry: true,
        attempts: 1,
        completedAt: "2026-01-01T00:00:00.000Z",
      },
    };
    expect(lessonQuizCount(lesson, quizAnswers)).toBe(1);
    expect(lessonMastered(lesson, {}, quizAnswers)).toBe(false);
    expect(lessonMastered(lesson, { [lesson.slug]: lesson.sections.map((section) => section.id) }, quizAnswers)).toBe(true);
  });
});
