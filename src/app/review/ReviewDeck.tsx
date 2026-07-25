"use client";

import { GlowCard } from "@/components/ui/GlowCard";
import { useHydrated } from "@/hooks/use-hydrated";
import { accentCssVar } from "@/lib/accent";
import { useProgress, type QuizResult } from "@/stores/progress";
import { ArrowRight, Compass } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { ReviewCard } from "./ReviewCard";
import {
  buildDeck,
  deckStats,
  TIER_ORDER,
  type DeckStats,
  type ReviewItem,
  type ReviewStatus,
} from "./deck";

/** Stable empty reference so the pre-hydration render doesn't thrash the memo. */
const EMPTY_QUIZZES: Record<string, QuizResult> = {};

const tierCopy: Record<ReviewStatus, { title: string; blurb: string }> = {
  missed: {
    title: "worth another look",
    blurb: "Predicted wrong the first time — the only thing between you and a mastered lesson.",
  },
  unattempted: {
    title: "not asked yet",
    blurb: "These checkpoints fire mid-run; you haven't reached them in a sim yet.",
  },
  mastered: {
    title: "called it first try",
    blurb: "Already right when it counted. Re-ask any of them to keep it that way.",
  },
};

/**
 * The practice deck: every prediction checkpoint in the track, re-askable.
 *
 * Assembled from the registry × each lesson's `LessonSim.quiz` × the persisted
 * results (see `./deck` for the tier ordering and its rationale). Answering
 * here writes NOTHING — the state is local to `ReviewCard`, and the page says
 * so — because `correctFirstTry` is earned once, in the lesson, with the sim
 * paused at the moment in question.
 *
 * Every store read goes through `useHydrated`: the static HTML is built without
 * localStorage, so pre-mount this renders the logged-out snapshot (every
 * checkpoint "not asked yet", in curriculum order), which is exactly the markup
 * the export carries. The real deck replaces it on the first client render.
 */
export function ReviewDeck() {
  const hydrated = useHydrated();
  const quizAnswers = useProgress((s) => s.quizAnswers);
  const answers = hydrated ? quizAnswers : EMPTY_QUIZZES;

  const items = useMemo(() => buildDeck(answers), [answers]);
  const stats = useMemo(() => deckStats(items), [items]);

  const tiers = useMemo(
    () =>
      TIER_ORDER.map((tier) => ({
        tier,
        items: items.filter((item) => item.status === tier),
      })).filter((group) => group.items.length > 0),
    [items],
  );

  // Brand-new visitor: nothing has ever been recorded. Gated on `hydrated` so a
  // returning learner never sees "you haven't started" flash before the store
  // is readable.
  const cold = hydrated && stats.recorded === 0;

  return (
    <>
      {cold ? <ColdStart total={stats.total} /> : <StatsPanel stats={stats} />}

      {items.length === 0 ? (
        <p className="text-sm text-fg-muted">
          No checkpoints are registered yet.
        </p>
      ) : (
        tiers.map((group) => (
          <section key={group.tier} className="mb-10">
            <div className="mb-1 flex items-center gap-3">
              <h2 className="tech-label text-fg">{tierCopy[group.tier].title}</h2>
              <span className="tech-num text-[11px] text-fg-faint">
                {group.items.length}
              </span>
              <div className="tech-rule min-w-6 flex-1" />
            </div>
            <p className="mb-4 text-[13px] text-fg-faint">
              {tierCopy[group.tier].blurb}
            </p>
            <div className="flex flex-col gap-4">
              {group.items.map((item: ReviewItem) => (
                <ReviewCard key={item.key} item={item} />
              ))}
            </div>
          </section>
        ))
      )}
    </>
  );
}

/** Headline first-try ratio + the per-module breakdown. */
function StatsPanel({ stats }: { stats: DeckStats }) {
  const pct = stats.total === 0 ? 0 : Math.round((stats.firstTry / stats.total) * 100);

  return (
    <GlowCard className="mb-10 px-5 py-4">
      <div className="mb-3 flex items-baseline gap-3">
        <span className="tech-label">first-try predictions</span>
        <div className="tech-rule min-w-6 flex-1" />
        <span className="tech-num text-2xl leading-none font-semibold text-accent">
          {stats.firstTry}
          <span className="text-sm text-fg-faint">/{stats.total}</span>
        </span>
      </div>

      <div
        className="mb-3 h-1.5 overflow-hidden rounded-full bg-raised"
        role="img"
        aria-label={`${stats.firstTry} of ${stats.total} checkpoints answered correctly on the first try`}
      >
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-700 ease-[var(--ease-out-soft)]"
          style={{
            width: `${pct}%`,
            boxShadow: pct > 0 ? "0 0 8px -1px var(--color-accent)" : undefined,
          }}
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {stats.byModule.map((stat) => (
          <span
            key={stat.module.slug}
            className="flex items-center gap-1.5 font-mono text-[11px] text-fg-faint"
          >
            <span
              className="size-1.5 shrink-0 rounded-full"
              style={{
                background: accentCssVar[stat.module.accent],
                opacity: stat.firstTry > 0 ? 1 : 0.35,
              }}
            />
            {stat.module.title}
            <span className="tech-num">
              {stat.firstTry}/{stat.total}
            </span>
          </span>
        ))}
        <span className="tech-num ml-auto text-[11px] text-fg-faint">
          {stats.missed > 0 && (
            <span className="text-glow-red">{stats.missed} missed</span>
          )}
          {stats.missed > 0 && stats.unattempted > 0 && " · "}
          {stats.unattempted > 0 && <span>{stats.unattempted} unseen</span>}
        </span>
      </div>

      <p className="mt-3 border-t border-border pt-3 text-[12px] leading-relaxed text-fg-faint">
        Answers on this page are practice — nothing here is recorded. A
        checkpoint&apos;s first-try result is earned once, inside the lesson,
        with the simulation paused on the moment it asks about.
      </p>
    </GlowCard>
  );
}

/** Nothing recorded yet — point at the track rather than at an empty scoreboard. */
function ColdStart({ total }: { total: number }) {
  return (
    <GlowCard active className="mb-10 px-5 py-5">
      <div className="flex items-start gap-3">
        <Compass className="mt-0.5 size-5 shrink-0 text-accent" strokeWidth={1.75} />
        <div>
          <p className="tech-label mb-1">no checkpoints recorded yet</p>
          <p className="font-display mb-2 text-lg leading-snug font-semibold">
            Predictions are earned in the simulations.
          </p>
          <p className="max-w-prose text-sm leading-relaxed text-fg-muted">
            Every lesson pauses its sim mid-run to ask what happens next. Answer
            one and it shows up here with your result. All {total} of them are
            listed below in the meantime — practise as many as you like, nothing
            on this page is recorded.
          </p>
          <Link
            href="/learn"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-bg transition-all hover:brightness-110"
          >
            Start the track
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </GlowCard>
  );
}
