/**
 * The review deck: registry × lesson sims × the learner's persisted results.
 *
 * Pure functions, no hooks and no store access — the page passes the answers
 * map in, so the ordering rules below are readable (and reasonable about) in
 * one place instead of being spread through JSX.
 */

import type { LessonMeta, Module } from "@/curriculum/types";
import type { QuizCheckpoint } from "@/engine/types";
import { getSim } from "@/lessons";
import { allLessons, lessonPath, moduleOf, modules } from "@/lib/curriculum";
import { quizKey, type QuizResult } from "@/stores/progress";

/**
 * How a checkpoint stands with this learner.
 *
 * - `missed` — recorded, and the FIRST attempt was wrong. `correctFirstTry` is
 *   never rewritten by retries (see the store), so this is permanent until a
 *   progress reset — which is exactly why it is worth practising.
 * - `unattempted` — nothing recorded. NOT "skipped": a checkpoint only records
 *   when a sim run actually reaches its `at` and the learner answers, so this
 *   is material the lesson has not asked yet.
 * - `mastered` — recorded, right first try. The state `lessonMastered` counts.
 */
export type ReviewStatus = "missed" | "unattempted" | "mastered";

export interface ReviewItem {
  /** `"<lessonSlug>/<quizId>"` — the progress-store key, and a stable React key. */
  key: string;
  lesson: LessonMeta;
  module: Module;
  quiz: QuizCheckpoint<unknown>;
  /** The persisted result, or null when this checkpoint has never fired. */
  result: QuizResult | null;
  status: ReviewStatus;
  /** Deep link to the lesson, seeked to the moment the question is about. */
  href: string;
}

/** Deck tiers, in the order the page renders them. */
export const TIER_ORDER: ReviewStatus[] = ["missed", "unattempted", "mastered"];

/**
 * Where "watch it happen" points.
 *
 * `?t=<quiz.at>` is consumed by `SectionFigure` → `InteractiveFigure`, which
 * replays the run to that sim-second and leaves it PAUSED there (autoplay is
 * suppressed for a seeked figure) — so the learner lands on the exact frame the
 * question is about and presses play to see the answer prove itself.
 *
 * The hash is the lesson's FIRST `interactive` section, which is where its
 * figure lives on every current page — the registry knows section ids but not
 * which one hosts the figure, and "the first interactive one" is the closest
 * honest answer. A lesson with no interactive section gets no hash and lands at
 * the top of the page (the figure is still seeked).
 *
 * Two consequences worth stating, both deliberate:
 * - the replay runs under the sim's DEFAULT params (see `SimRunner.seekTo`), so
 *   a `when`-gated checkpoint's premise may not hold at `at`; the link means
 *   "this moment", not "this checkpoint re-armed";
 * - seeking past a checkpoint forfeits it for that run, so the quiz overlay
 *   will NOT re-ask on arrival. That is the intent: the learner just answered
 *   it here, they came to watch, not to be quizzed again.
 */
export function watchHref(lesson: LessonMeta, quiz: QuizCheckpoint<unknown>): string {
  const figureSection = lesson.sections.find((s) => s.kind === "interactive");
  const hash = figureSection ? `#${figureSection.id}` : "";
  return `${lessonPath(lesson)}?t=${quiz.at}${hash}`;
}

function statusOf(result: QuizResult | null): ReviewStatus {
  if (!result) return "unattempted";
  return result.correctFirstTry ? "mastered" : "missed";
}

/**
 * Build the whole deck, ordered for practice.
 *
 * TIER ORDER — worst first, revision last:
 *   1. `missed`      — the checkpoints that cost mastery (`lessonMastered`
 *                      refuses any lesson holding one). They are the reason
 *                      this page exists, so they lead.
 *   2. `unattempted` — never asked. Ranked above mastered because it is open
 *                      material, below missed because nothing is known to be
 *                      wrong yet; rendered visually distinct (dashed, muted)
 *                      so an empty record never reads as a bad score.
 *   3. `mastered`    — right first try. Kept in the deck rather than hidden —
 *                      a practice deck you cannot re-practise is a scoreboard —
 *                      but it sits under the work.
 *
 * WITHIN a tier: curriculum order (module → lesson → checkpoint `at`), so each
 * tier reads top-to-bottom the way the track does, and a lesson's two
 * checkpoints stay in the order the sim asks them.
 *
 * Lessons whose sim is missing from `simBySlug` are skipped (see `getSim`), as
 * are `coming-soon` lessons — neither has a page to watch it happen on.
 */
export function buildDeck(answers: Record<string, QuizResult>): ReviewItem[] {
  const items: ReviewItem[] = [];

  for (const lesson of allLessons) {
    if (lesson.status !== "available") continue;
    const sim = getSim(lesson.slug);
    if (!sim?.quiz?.length) continue;

    // `mod`, not `module`: the identifier is reserved-ish in a bundled module
    // scope and lint-banned project-wide (@next/next/no-assign-module-variable).
    const mod = moduleOf(lesson);
    // `at` ascending: the registry fixes lesson order, the sim fixes the order
    // its own checkpoints are asked in.
    const quizzes = [...sim.quiz].sort((a, b) => a.at - b.at);

    for (const quiz of quizzes) {
      const key = quizKey(lesson.slug, quiz.id);
      const result = answers[key] ?? null;
      items.push({
        key,
        lesson,
        module: mod,
        quiz,
        result,
        status: statusOf(result),
        href: watchHref(lesson, quiz),
      });
    }
  }

  // Stable sort (ES2019+) over an array already in curriculum order, so the
  // tier is the only thing this reorders.
  return items.sort(
    (a, b) => TIER_ORDER.indexOf(a.status) - TIER_ORDER.indexOf(b.status),
  );
}

export interface ModuleStat {
  module: Module;
  firstTry: number;
  total: number;
}

export interface DeckStats {
  total: number;
  /** Right first try — the numerator of the headline. */
  firstTry: number;
  missed: number;
  unattempted: number;
  /** Checkpoints with any record at all. 0 ⇒ brand-new visitor. */
  recorded: number;
  byModule: ModuleStat[];
}

/**
 * Headline + per-module breakdown.
 *
 * The denominator is EVERY checkpoint in the track, not just the answered ones:
 * "18/30 first-try" has to mean the same thing on day one and at the end, and a
 * ratio over answered-only would start at a flattering 0/0 and drop as the
 * learner works. Unattempted checkpoints therefore count against the headline,
 * which is the honest reading of "how much of this track have I predicted
 * correctly".
 */
export function deckStats(items: ReviewItem[]): DeckStats {
  // Seeded from the registry, not from the items, so the breakdown reads in
  // curriculum order however the deck itself happens to be sorted.
  const byModule = new Map<string, ModuleStat>(
    modules.map((mod) => [mod.slug, { module: mod, firstTry: 0, total: 0 }]),
  );
  let firstTry = 0;
  let missed = 0;
  let unattempted = 0;

  for (const item of items) {
    const stat = byModule.get(item.module.slug);
    if (!stat) continue;
    stat.total += 1;
    if (item.status === "mastered") {
      firstTry += 1;
      stat.firstTry += 1;
    } else if (item.status === "missed") {
      missed += 1;
    } else {
      unattempted += 1;
    }
  }

  return {
    total: items.length,
    firstTry,
    missed,
    unattempted,
    recorded: firstTry + missed,
    // A module whose lessons ship no checkpoints yet would be a 0/0 row.
    byModule: [...byModule.values()].filter((stat) => stat.total > 0),
  };
}
