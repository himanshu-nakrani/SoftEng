"use client";

import { cn } from "@/lib/cn";
import { ArrowRight, Check, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { QuizCheckpoint } from "../types";

interface PredictionQuizProps {
  quiz: QuizCheckpoint | null;
  answer: string | null;
  onAnswer: (choiceId: string) => void;
  onResume: () => void;
}

/**
 * The "predict" interaction: the sim hard-pauses, the learner commits to a
 * prediction, then the sim resumes and *proves* the outcome. Wrong answers
 * are the best teacher — reality contradicts them on screen.
 */
export function PredictionQuiz({
  quiz,
  answer,
  onAnswer,
  onResume,
}: PredictionQuizProps) {
  return (
    <AnimatePresence>
      {quiz && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-10 flex items-center justify-center bg-bg/75 p-4 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.96, y: 8 }}
            animate={{ scale: 1, y: 0 }}
            className="w-full max-w-md rounded-lg border border-glow-violet/40 bg-surface p-5 shadow-[0_0_40px_-12px_var(--color-glow-violet)]"
          >
            <p className="tech-label mb-2 text-glow-violet">
              predict — sim paused
            </p>
            <p className="mb-4 text-sm leading-relaxed font-medium">
              {quiz.question}
            </p>

            <div className="flex flex-col gap-2">
              {quiz.choices.map((choice) => {
                const chosen = answer === choice.id;
                const correct = choice.id === quiz.correctChoiceId;
                const revealed = answer !== null;
                return (
                  <button
                    key={choice.id}
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
                  <button
                    onClick={onResume}
                    className="mt-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-glow-violet px-4 py-2.5 text-sm font-semibold text-bg transition-all hover:brightness-110"
                  >
                    Watch it happen
                    <ArrowRight className="size-4" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
