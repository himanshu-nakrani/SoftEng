"use client";

import { InteractiveFigure } from "@/engine/components/InteractiveFigure";
import type { SimSnapshot } from "@/engine/snapshot";
import type { SimEvent } from "@/engine/useSimulation";
import type { LessonSim, NodeSpec } from "@/engine/types";
import { quizKey, useProgress } from "@/stores/progress";
import { useCallback, useRef, type ReactNode } from "react";
import {
  useLessonCompletion,
  useLessonMeta,
  useSectionCompletion,
} from "./context";

/**
 * Routes one sim interaction to a section elsewhere in the lesson — for
 * sections whose subject is a control that lives in another section's figure.
 */
export interface CompletionRule {
  on: SimEvent["kind"];
  /** Param key / button key / node id. Omitted = any id of that kind. */
  id?: string;
  /** quiz-answered only: require the answer to be right. */
  correctOnly?: boolean;
  /** Registry section id to complete. */
  section: string;
}

interface SectionFigureProps<L> {
  sim: LessonSim<L>;
  description: string;
  autoplay?: boolean;
  seed?: number;
  stageOverlay?: (snapshot: SimSnapshot) => ReactNode;
  nodeOverlay?: (
    spec: NodeSpec,
    runtime: SimSnapshot["nodes"][string],
    snapshot: SimSnapshot,
  ) => ReactNode;
  completes?: CompletionRule[];
}

/**
 * InteractiveFigure wired into the lesson's progress system: the figure's own
 * section completes on first meaningful interaction, `completes` rules can
 * complete other sections, and quiz checkpoints are recorded. Keeps the
 * engine layer free of any progress/curriculum dependency.
 */
export function SectionFigure<L>({
  sim,
  description,
  autoplay,
  seed,
  stageOverlay,
  nodeOverlay,
  completes,
}: SectionFigureProps<L>) {
  const markComplete = useSectionCompletion();
  const completeLessonSection = useLessonCompletion();
  const recordQuiz = useProgress((s) => s.recordQuiz);
  const { slug } = useLessonMeta();

  // Rules are authored inline, so a ref keeps the handler stable.
  const rulesRef = useRef(completes);
  rulesRef.current = completes;

  const onSimEvent = useCallback(
    (ev: SimEvent) => {
      for (const rule of rulesRef.current ?? []) {
        if (rule.on !== ev.kind) continue;
        if (rule.id !== undefined && rule.id !== ev.id) continue;
        if (rule.correctOnly && !(ev.kind === "quiz-answered" && ev.correct)) {
          continue;
        }
        completeLessonSection(rule.section);
      }
    },
    [completeLessonSection],
  );

  const onQuizResult = useCallback(
    (quizId: string, choiceId: string, correct: boolean) => {
      recordQuiz(quizKey(slug, quizId), choiceId, correct);
    },
    [recordQuiz, slug],
  );

  return (
    <InteractiveFigure
      sim={sim}
      description={description}
      autoplay={autoplay}
      seed={seed}
      stageOverlay={stageOverlay}
      nodeOverlay={nodeOverlay}
      onEngage={markComplete}
      onSimEvent={onSimEvent}
      onQuizResult={onQuizResult}
    />
  );
}
