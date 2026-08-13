"use client";

import { cn } from "@/lib/cn";
import { ArrowRight, Check, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useId, useRef, type KeyboardEvent } from "react";
import type { QuizCheckpoint } from "../types";

interface PredictionQuizProps {
  quiz: QuizCheckpoint | null;
  answer: string | null;
  onAnswer: (choiceId: string) => void;
  /** Dismiss an answered quiz but leave its deterministic frame paused. */
  onDismiss: () => void;
  onResume: () => void;
}

/**
 * The "predict" interaction: the sim hard-pauses, the learner commits to a
 * prediction, then the sim resumes and *proves* the outcome. Wrong answers
 * are the best teacher — reality contradicts them on screen.
 *
 * Accessibility contract:
 * - the card is an `alertdialog` (it interrupts a running sim and demands an
 *   answer) labelled by the question, so opening it announces the prompt;
 * - focus lands on the first choice when a checkpoint fires, and moves to
 *   "Watch it happen" once answered (the choices become disabled, which would
 *   otherwise drop focus to the document);
 * - Up/Down/Home/End move between choices — the whole list is one arrow-able
 *   set rather than N unrelated tab stops. Selection does NOT follow focus
 *   here: activating a choice commits the prediction, so it stays on
 *   Space/Enter/click;
 * - the verdict is mirrored into an sr-only live region, because the visual
 *   verdict is colour + icon only.
 */
export function PredictionQuiz({
  quiz,
  answer,
  onAnswer,
  onDismiss,
  onResume,
}: PredictionQuizProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const choiceRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const resumeRef = useRef<HTMLButtonElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const fallbackFocusRef = useRef<HTMLElement | null>(null);
  const quizId = quiz?.id ?? null;

  // A checkpoint fired: pull focus into the dialog. Keyed on the quiz id so a
  // re-render (or a second checkpoint later in the run) re-arms it, while
  // answering the current one does not yank focus back to the choices. On
  // close, focus goes back where the checkpoint took it from — otherwise
  // dismissing the dialog drops a keyboard user at the top of the document.
  useEffect(() => {
    if (quizId === null) return;
    const active = document.activeElement;
    returnFocusRef.current =
      active instanceof HTMLElement && active !== document.body ? active : null;
    // A pointer may trigger a checkpoint without leaving a meaningful active
    // element. The figure itself is a safe, keyboard-operable fallback in that
    // edge case, so dismissing the dialog never leaves screen readers at <body>.
    fallbackFocusRef.current = dialogRef.current?.closest<HTMLElement>("figure") ?? null;
    choiceRefs.current[0]?.focus();
    // AnimatePresence keeps the dialog mounted through its exit animation. Its
    // `onExitComplete` callback below performs focus restoration only after the
    // fading subtree is gone; restoring here would be discarded by Chromium.
    return undefined;
  }, [quizId]);

  // Answered: the choices just became disabled, so hand focus to the only
  // remaining action.
  useEffect(() => {
    if (quizId === null || answer === null) return;
    resumeRef.current?.focus();
  }, [quizId, answer]);

  // `aria-modal` is only honest when focus cannot escape. The dialog owns a
  // small, explicit button set, so trap Tab at document level as well: this
  // catches both ordinary traversal and the rare case where a pointer left
  // focus outside the overlay before its next keypress.
  useEffect(() => {
    if (quizId === null) return;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const dialog = dialogRef.current;
      const items = Array.from(
        dialog?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? [],
      );
      if (items.length === 0) {
        event.preventDefault();
        dialog?.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (!(active instanceof HTMLElement) || !dialog?.contains(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [quizId]);

  // Escape is deliberately unavailable until an answer has been committed: a
  // checkpoint must not be skippable, but an answered explanation must never
  // trap the learner over the simulation.
  useEffect(() => {
    if (quizId === null || answer === null) return;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onDismiss();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [quizId, answer, onDismiss]);

  const onChoiceKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const count = quiz?.choices.length ?? 0;
    const current = choiceRefs.current.indexOf(
      event.target as HTMLButtonElement,
    );
    if (current === -1 || count === 0) return;
    const last = count - 1;
    let next: number;
    switch (event.key) {
      case "ArrowDown":
        next = current === last ? 0 : current + 1;
        break;
      case "ArrowUp":
        next = current === 0 ? last : current - 1;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = last;
        break;
      default:
        return;
    }
    event.preventDefault();
    choiceRefs.current[next]?.focus();
  };

  const restoreFocus = () => {
    const previous = returnFocusRef.current;
    const fallback = fallbackFocusRef.current;
    returnFocusRef.current = null;
    fallbackFocusRef.current = null;
    if (previous?.isConnected) previous.focus();
    else if (fallback?.isConnected) fallback.focus();
  };

  const correctLabel =
    quiz?.choices.find((c) => c.id === quiz.correctChoiceId)?.label ?? "";
  const verdict =
    quiz === null || answer === null
      ? ""
      : answer === quiz.correctChoiceId
        ? "Correct."
        : `Not quite — the correct answer was ${correctLabel}.`;

  return (
    <AnimatePresence onExitComplete={restoreFocus}>
      {quiz && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          // items-start + scroll on phones: the stage is short and its wrapper
          // clips, so a centred card would have its top and bottom cut off.
          className="absolute inset-0 z-10 flex items-start justify-center overflow-y-auto bg-bg/75 p-4 backdrop-blur-sm sm:items-center"
        >
          <motion.div
            initial={{ scale: 0.96, y: 8 }}
            animate={{ scale: 1, y: 0 }}
            ref={dialogRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            tabIndex={-1}
            className="relative max-h-full w-full max-w-md overflow-y-auto rounded-lg border border-glow-violet/40 bg-surface p-5 shadow-[0_0_40px_-12px_var(--color-glow-violet)]"
          >
            <p className="tech-label mb-2 text-glow-violet">
              predict — sim paused
            </p>
            <p
              id={titleId}
              className="mb-4 text-sm leading-relaxed font-medium"
            >
              {quiz.question}
            </p>

            <p id={descriptionId} className="sr-only">
              {answer === null
                ? "Choose one prediction. The simulation is paused until you answer."
                : `${verdict} ${quiz.explain} Choose Close and inspect to study the paused state, or Watch it happen to resume playback.`}
            </p>

            <div className="flex flex-col gap-2" onKeyDown={onChoiceKeyDown}>
              {quiz.choices.map((choice, i) => {
                const chosen = answer === choice.id;
                const correct = choice.id === quiz.correctChoiceId;
                const revealed = answer !== null;
                return (
                  <button
                    key={choice.id}
                    ref={(el) => {
                      choiceRefs.current[i] = el;
                    }}
                    type="button"
                    disabled={revealed}
                    onClick={() => onAnswer(choice.id)}
                    className={cn(
                      "flex cursor-pointer items-center gap-2.5 rounded-lg border px-3.5 py-2.5 text-left text-sm transition-all",
                      !revealed &&
                        "border-border hover:border-glow-violet/60 hover:bg-raised",
                      revealed && correct &&
                        "border-glow-green/60 bg-glow-green-dim text-glow-green",
                      revealed && chosen && !correct &&
                        "border-glow-red/60 bg-glow-red-dim text-glow-red",
                      revealed && !chosen && !correct &&
                        "border-border opacity-45",
                    )}
                  >
                    {revealed && correct && <Check className="size-4 shrink-0" />}
                    {revealed && chosen && !correct && (
                      <X className="size-4 shrink-0" />
                    )}
                    {choice.label}
                  </button>
                );
              })}
            </div>

            {/* Present from the moment the dialog opens so the verdict is a
                content change inside a live region, not a region that appears
                already populated (which several screen readers skip). */}
            <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
              {verdict}
            </p>

            <AnimatePresence>
              {answer !== null && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="overflow-hidden"
                >
                  <p className="mt-4 border-l-2 border-glow-violet/50 pl-3 text-[13px] leading-relaxed text-fg-muted">
                    {quiz.explain}
                  </p>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={onDismiss}
                      className="cursor-pointer rounded-lg border border-border bg-raised px-4 py-2.5 text-sm font-semibold text-fg transition-colors hover:border-border-bright hover:bg-surface"
                    >
                      Close and inspect
                    </button>
                    <button
                      ref={resumeRef}
                      type="button"
                      onClick={onResume}
                      className="flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-glow-violet px-4 py-2.5 text-sm font-semibold text-bg transition-all hover:brightness-110"
                    >
                      Watch it happen
                      <ArrowRight className="size-4" />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
