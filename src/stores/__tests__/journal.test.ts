import { describe, expect, it } from "vitest";
import { allLessons } from "@/lib/curriculum";
import { buildDeck, prioritizeDeck } from "@/app/review/deck";
import {
  JOURNAL_NOTE_LIMIT,
  mergeJournal,
  sanitizeJournal,
  type JournalEntry,
} from "../journal";

describe("local learning journal", () => {
  it("sanitizes bounded notes and replay-ready primitive parameters", () => {
    const journal = sanitizeJournal({
      entries: {
        "scaling/scaling-strategies": {
          note: "x".repeat(JOURNAL_NOTE_LIMIT + 20),
          confidence: "can-explain",
          updatedAt: "2026-01-01T00:00:00.000Z",
          replay: {
            lessonSlug: "scaling/scaling-strategies",
            at: 12,
            seed: 42,
            params: { scale: 2, strategy: "horizontal", ignored: { bad: true } },
          },
        },
      },
    });

    const entry = journal.entries["scaling/scaling-strategies"];
    expect(entry.note).toHaveLength(JOURNAL_NOTE_LIMIT);
    expect(entry.replay?.params).toEqual({ scale: 2, strategy: "horizontal" });
  });

  it("keeps the newer imported reflection without mutating the base snapshot", () => {
    const base: JournalEntry = {
      note: "old",
      confidence: "uncertain",
      updatedAt: "2026-01-01T00:00:00.000Z",
      replay: null,
    };
    const incoming: JournalEntry = {
      note: "new",
      confidence: "getting-it",
      updatedAt: "2026-01-02T00:00:00.000Z",
      replay: null,
    };
    const result = mergeJournal(
      { entries: { lesson: base } },
      { entries: { lesson: incoming } },
    );
    expect(result.next.entries.lesson).toEqual(incoming);
    expect(base.note).toBe("old");
    expect(result.summary.entriesUpdated).toBe(1);
  });

  it("prioritizes uncertain lessons within an otherwise stable review tier", () => {
    const items = buildDeck({});
    const first = items[0];
    const second = items[1];
    const ordered = prioritizeDeck(items.slice(0, 2), {
      [first.lesson.slug]: {
        note: "ready",
        confidence: "can-explain",
        updatedAt: "2026-01-01T00:00:00.000Z",
        replay: null,
      },
      [second.lesson.slug]: {
        note: "needs another pass",
        confidence: "uncertain",
        updatedAt: "2026-01-01T00:00:00.000Z",
        replay: null,
      },
    });
    expect(ordered[0].lesson.slug).toBe(second.lesson.slug);
    expect(allLessons.length).toBeGreaterThan(20);
  });
});
