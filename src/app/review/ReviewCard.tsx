"use client";

import { GlowCard } from "@/components/ui/GlowCard";
import { getLearningGuide } from "@/curriculum/learning";
import { useJournal } from "@/stores/journal";
import { accentCssVar } from "@/lib/accent";
import { cn } from "@/lib/cn";
import { ArrowRight, Check, RotateCcw, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import type { ReviewItem, ReviewStatus } from "./deck";

/** The chip in the card's top-right — what the STORE says, before any practice. */
const statusChip: Record<ReviewStatus, { label: string; className: string }> = {
  missed: {
    label: "missed first try",
    className: "bg-glow-red-dim text-glow-red",
  },
  unattempted: {
    label: "not asked yet",
    className: "bg-raised text-fg-muted",
  },
  mastered: {
    label: "first try",
    className: "bg-glow-green-dim text-glow-green",
  },
};

/**
 * One checkpoint, re-asked.
 *
 * NO WRITES. The answer lives in this component's `useState` and dies with the
 * page: `recordQuiz` is never called from /review, and neither is any other
 * store action. That is the whole design of the deck —
 * `QuizResult.correctFirstTry` is the fact `lessonMastered` is built on, and it
 * can only be earned once, in the lesson, with the sim paused at the moment the
 * question is about. Letting a practice answer write here would either launder
 * a miss into mastery (if it overwrote) or inflate `attempts` with rehearsal
 * that never happened in a run (if it merged). Practice is rehearsal; the
 * record stays whatever the lesson recorded. The card says so in its footer, so
 * a learner is never guessing whether this counts.
 *
 * Verdict vocabulary is `PredictionQuiz`'s, deliberately: green + check for the
 * correct choice, red + X for a wrong one you picked, the others dimmed, the
 * explanation behind a violet rule, and the verdict mirrored into an sr-only
 * live region because colour + icon is the only visual signal.
 */
export function ReviewCard({ item }: { item: ReviewItem }) {
  const [choice, setChoice] = useState<string | null>(null);
  const questionId = useId();
  const choiceRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const askAgainRef = useRef<HTMLButtonElement>(null);
  const { quiz } = item;
  const guide = getLearningGuide(item.lesson.slug);
  const confidence = useJournal((state) => state.entries[item.lesson.slug]?.confidence);
  const confidenceLabel =
    confidence === "can-explain"
      ? "can explain"
      : confidence === "getting-it"
        ? "getting it"
        : confidence === "uncertain"
          ? "uncertain"
          : "not rated";

  const revealed = choice !== null;
  const chip = statusChip[item.status];
  const correctLabel =
    quiz.choices.find((c) => c.id === quiz.correctChoiceId)?.label ?? "";
  const answeredCorrectly = choice === quiz.correctChoiceId;
  const verdict = !revealed
    ? ""
    : answeredCorrectly
      ? "Correct — that is the system behavior to expect."
      : `Not quite — the correct answer was ${correctLabel}.`;

  // The chosen answer disables every option. Move focus to the recovery action
  // instead of allowing it to disappear with the newly disabled button.
  useEffect(() => {
    if (revealed) askAgainRef.current?.focus();
  }, [revealed]);

  function askAgain() {
    setChoice(null);
    requestAnimationFrame(() => choiceRefs.current[0]?.focus());
  }

  return (
    <GlowCard
      accent={item.module.accent}
      className={cn(
        "p-5",
        // An untouched checkpoint is absence of data, not a bad score — the
        // dashed edge says "outline" rather than "result".
        item.status === "unattempted" && "border-dashed",
      )}
    >
      <div className="mb-3 flex items-start gap-3">
        <div className="min-w-0">
          {/* Kicker: the module in its own accent, then the lesson — the same
              "where am I" line the lesson map uses, in one row. */}
          <p className="tech-label mb-1 truncate">
            <span style={{ color: accentCssVar[item.module.accent] }}>
              {item.module.title}
            </span>
            {" · "}
            {item.lesson.title}
          </p>
          <p
            id={questionId}
            className="text-sm leading-relaxed font-medium text-fg"
          >
            {quiz.question}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-fg-faint">
            <span className="font-mono text-[9px] tracking-widest text-accent uppercase">
              learning lens ·{" "}
            </span>
            {guide.tryNext}
          </p>
        </div>
        <div className="ml-auto flex shrink-0 flex-wrap justify-end gap-1.5">
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 font-mono text-[10px] tracking-wide whitespace-nowrap",
              chip.className,
            )}
          >
            {chip.label}
          </span>
          <span className="rounded-full bg-raised px-2.5 py-0.5 font-mono text-[10px] tracking-wide text-fg-faint whitespace-nowrap">
            {confidenceLabel}
          </span>
        </div>
      </div>

      <div
        className="flex flex-col gap-2"
        role="group"
        aria-labelledby={questionId}
      >
        {quiz.choices.map((c, index) => {
          const chosen = choice === c.id;
          const correct = c.id === quiz.correctChoiceId;
          return (
            <button
              key={c.id}
              ref={(element) => {
                choiceRefs.current[index] = element;
              }}
              type="button"
              disabled={revealed}
              onClick={() => setChoice(c.id)}
              className={cn(
                "flex cursor-pointer items-center gap-2.5 rounded-lg border px-3.5 py-2.5 text-left text-[13px] transition-all",
                !revealed &&
                  "border-border hover:border-glow-violet/60 hover:bg-raised",
                revealed &&
                  correct &&
                  "border-glow-green/60 bg-glow-green-dim text-glow-green",
                revealed &&
                  chosen &&
                  !correct &&
                  "border-glow-red/60 bg-glow-red-dim text-glow-red",
                revealed && !chosen && !correct && "border-border opacity-45",
                revealed && "cursor-default",
              )}
            >
              {revealed && correct && <Check className="size-4 shrink-0" />}
              {revealed && chosen && !correct && (
                <X className="size-4 shrink-0" />
              )}
              {c.label}
            </button>
          );
        })}
      </div>

      {/* Present from first render so the verdict is announced as a content
          change. The explanation is visible as well: practice should resolve
          uncertainty immediately, not hide the learning moment from sighted
          learners. */}
      <p role="status" className="sr-only">
        {verdict}
      </p>

      {revealed && (
        <div
          className={cn(
            "mt-4 rounded-lg border px-3.5 py-3",
            answeredCorrectly
              ? "border-glow-green/35 bg-glow-green-dim"
              : "border-glow-violet/35 bg-glow-violet-dim",
          )}
        >
          <p
            className={cn(
              "text-[13px] font-medium",
              answeredCorrectly ? "text-glow-green" : "text-glow-violet",
            )}
          >
            {verdict}
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-fg-muted">
            {quiz.explain}
          </p>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-3">
        <Link
          href={item.href}
          aria-label={`Revisit the exact simulation moment for ${item.lesson.title}: ${quiz.question}`}
          className="group inline-flex items-center gap-1.5 text-[13px] font-medium text-accent transition-colors hover:brightness-110"
        >
          Revisit exact moment
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>

        {revealed && (
          <button
            type="button"
            ref={askAgainRef}
            onClick={askAgain}
            className="inline-flex min-h-8 cursor-pointer items-center gap-1.5 text-[13px] text-fg-faint transition-colors hover:text-fg-muted"
          >
            <RotateCcw className="size-3.5" />
            Ask again
          </button>
        )}

        <span className="tech-label ml-auto text-fg-faint">
          practice · not recorded
        </span>
      </div>
    </GlowCard>
  );
}
