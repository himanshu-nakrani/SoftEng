import {
  PROGRESS_VERSION,
  buildProgressExport,
  isEmptyProgress,
  mergeProgress,
  quizKey,
  readProgressExport,
  sanitizeProgress,
  type PersistedProgress,
  type QuizResult,
} from "@/stores/progress";
import { describe, expect, it } from "vitest";

/**
 * The progress store's guarantees, tested.
 *
 * These were previously asserted only in prose ("corrupt localStorage can't
 * crash pages", "import is never destructive") and exercised only end-to-end
 * through Playwright, which needs a full build and cannot reach the edge cases
 * that matter here — `localStorage` is user-writable, and older builds wrote
 * other shapes.
 *
 * Everything here is pure, so it runs in the existing node environment. Hook
 * rendering (`useHydrated`, `useLessonProgress`) still needs a jsdom project and
 * a renderer; that remains open in debt.md as D2.
 */

const answer = (over: Partial<QuizResult> = {}): QuizResult => ({
  choiceId: "a",
  correctFirstTry: true,
  attempts: 1,
  completedAt: "2026-01-01T00:00:00.000Z",
  ...over,
});

describe("sanitizeProgress: nothing unrecognizable reaches progress math", () => {
  it("returns an empty snapshot for anything that is not an object", () => {
    for (const junk of [null, undefined, 42, "nope", [], true]) {
      const clean = sanitizeProgress(junk);
      expect(clean.completedSections).toEqual({});
      expect(clean.quizAnswers).toEqual({});
      expect(clean.lastVisited).toBeNull();
    }
  });

  it("drops a completedSections entry that is not an array of strings", () => {
    const clean = sanitizeProgress({
      completedSections: {
        good: ["a", "b"],
        notAnArray: "a,b",
        mixed: ["a", 7, null, "b"],
        emptyAfterFiltering: [1, 2, 3],
      },
    });
    expect(clean.completedSections).toEqual({
      good: ["a", "b"],
      // Non-strings filtered out rather than the whole entry discarded.
      mixed: ["a", "b"],
    });
    // An entry that filters down to nothing is omitted, not left as [].
    expect(clean.completedSections).not.toHaveProperty("emptyAfterFiltering");
    expect(clean.completedSections).not.toHaveProperty("notAnArray");
  });

  it("drops a quiz record with any field of the wrong type", () => {
    const clean = sanitizeProgress({
      quizAnswers: {
        good: answer(),
        missingChoice: { correctFirstTry: true, attempts: 1, completedAt: "x" },
        badBoolean: { ...answer(), correctFirstTry: "yes" },
        nonFiniteAttempts: { ...answer(), attempts: Number.NaN },
        infiniteAttempts: { ...answer(), attempts: Number.POSITIVE_INFINITY },
        nullRecord: null,
      },
    });
    expect(Object.keys(clean.quizAnswers)).toEqual(["good"]);
  });

  it("keeps lastVisited only when both fields are strings", () => {
    expect(
      sanitizeProgress({ lastVisited: { lessonSlug: "a", sectionId: "b" } })
        .lastVisited,
    ).toEqual({ lessonSlug: "a", sectionId: "b" });

    for (const bad of [
      { lessonSlug: "a" },
      { lessonSlug: 1, sectionId: "b" },
      "a/b",
      null,
    ]) {
      expect(sanitizeProgress({ lastVisited: bad }).lastVisited).toBeNull();
    }
  });

  it("ignores unknown fields rather than carrying them through", () => {
    const clean = sanitizeProgress({
      completedSections: { a: ["x"] },
      somethingAnOlderBuildWrote: { deeply: { nested: true } },
    });
    expect(Object.keys(clean).sort()).toEqual([
      "completedSections",
      "lastVisited",
      "quizAnswers",
    ]);
  });
});

describe("mergeProgress: an import is never destructive", () => {
  const base: PersistedProgress = {
    completedSections: { caching: ["why-cache", "tune-it"] },
    quizAnswers: { "caching/q1": answer({ correctFirstTry: false, attempts: 3 }) },
    lastVisited: { lessonSlug: "caching", sectionId: "tune-it" },
  };

  it("unions completed sections — a section cannot un-complete", () => {
    const { next, summary } = mergeProgress(base, {
      completedSections: { caching: ["eviction"], sharding: ["why-shard"] },
      quizAnswers: {},
      lastVisited: null,
    });
    expect(next.completedSections.caching).toEqual([
      "why-cache",
      "tune-it",
      "eviction",
    ]);
    expect(next.completedSections.sharding).toEqual(["why-shard"]);
    expect(summary.sectionsAdded).toBe(2);
  });

  it("never removes a section the incoming snapshot lacks", () => {
    const { next } = mergeProgress(base, {
      completedSections: {},
      quizAnswers: {},
      lastVisited: null,
    });
    expect(next.completedSections.caching).toEqual(["why-cache", "tune-it"]);
  });

  it("counts an already-known section as added zero times", () => {
    const { summary } = mergeProgress(base, {
      completedSections: { caching: ["why-cache"] },
      quizAnswers: {},
      lastVisited: null,
    });
    expect(summary.sectionsAdded).toBe(0);
  });

  it("lets a first-try-correct record win, whichever side holds it", () => {
    const incoming: PersistedProgress = {
      completedSections: {},
      quizAnswers: { "caching/q1": answer({ correctFirstTry: true, attempts: 1 }) },
      lastVisited: null,
    };
    // Incoming is first-try-correct, base is not: incoming wins despite fewer
    // attempts, because mastery can never be re-earned.
    expect(mergeProgress(base, incoming).next.quizAnswers["caching/q1"])
      .toMatchObject({ correctFirstTry: true });
    // And the same record must survive a merge in the other direction.
    expect(mergeProgress(incoming, base).next.quizAnswers["caching/q1"])
      .toMatchObject({ correctFirstTry: true });
  });

  it("prefers the fuller history when both agree on first-try", () => {
    const incoming: PersistedProgress = {
      completedSections: {},
      quizAnswers: { "caching/q1": answer({ correctFirstTry: false, attempts: 5 }) },
      lastVisited: null,
    };
    expect(
      mergeProgress(base, incoming).next.quizAnswers["caching/q1"].attempts,
    ).toBe(5);
  });

  it("takes the incoming lastVisited only when it has one", () => {
    const withPointer = mergeProgress(base, {
      completedSections: {},
      quizAnswers: {},
      lastVisited: { lessonSlug: "sharding", sectionId: "route-keys" },
    });
    expect(withPointer.next.lastVisited).toEqual({
      lessonSlug: "sharding",
      sectionId: "route-keys",
    });

    const withoutPointer = mergeProgress(base, {
      completedSections: {},
      quizAnswers: {},
      lastVisited: null,
    });
    expect(withoutPointer.next.lastVisited).toEqual(base.lastVisited);
  });

  it("is idempotent — importing the same snapshot twice changes nothing", () => {
    const once = mergeProgress(base, base);
    const twice = mergeProgress(once.next, base);
    expect(twice.next).toEqual(once.next);
    expect(twice.summary.sectionsAdded).toBe(0);
  });
});

describe("export envelope", () => {
  const state: PersistedProgress = {
    completedSections: { caching: ["why-cache"] },
    quizAnswers: { "caching/q1": answer() },
    lastVisited: null,
  };

  it("round-trips through its own reader", () => {
    expect(readProgressExport(buildProgressExport(state))).toEqual(state);
  });

  it("reads a bare state object too, for a hand-edited file", () => {
    expect(readProgressExport(state)).toEqual(state);
  });

  it("sanitizes on the way in, so a hostile file cannot inject shapes", () => {
    const hostile = {
      app: "syslab",
      version: PROGRESS_VERSION,
      state: {
        completedSections: { caching: "not-an-array" },
        quizAnswers: { bad: { choiceId: 1 } },
        lastVisited: 42,
      },
    };
    expect(readProgressExport(hostile)).toEqual({
      completedSections: {},
      quizAnswers: {},
      lastVisited: null,
    });
  });

  it("stamps the version the store actually persists", () => {
    expect(buildProgressExport(state).version).toBe(PROGRESS_VERSION);
  });
});

describe("small contracts", () => {
  it("scopes a quiz key by lesson, because quiz ids repeat across lessons", () => {
    expect(quizKey("caching", "q1")).toBe("caching/q1");
    expect(quizKey("sharding", "q1")).not.toBe(quizKey("caching", "q1"));
  });

  it("treats a snapshot with only a lastVisited pointer as empty", () => {
    // Otherwise merely opening a lesson would enable the export/reset controls.
    expect(
      isEmptyProgress({
        completedSections: {},
        quizAnswers: {},
        lastVisited: { lessonSlug: "caching", sectionId: "why-cache" },
      }),
    ).toBe(true);
  });
});
