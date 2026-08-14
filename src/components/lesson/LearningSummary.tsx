"use client";

import type { LessonMeta } from "@/curriculum/types";
import { useLessonProgress } from "@/hooks/use-lesson-progress";
import { getLearningGuide } from "@/curriculum/learning";
import { ArrowRight, Compass, FlaskConical, Lightbulb } from "lucide-react";

const activityCopy = {
  untouched: "Before you experiment",
  explored: "You have seen the path",
  predicted: "You have made a prediction",
  complete: "You have visited every section",
  mastered: "You have a clean first-try record",
} as const;

/**
 * A quiet post-simulation translation layer. The engine explains mechanics;
 * this card explains what to carry into the next design decision.
 */
export function LearningSummary({ meta }: { meta: LessonMeta }) {
  const guide = getLearningGuide(meta.slug);
  const progress = useLessonProgress(meta);

  return (
    <section
      className="surface-card mb-12 overflow-hidden border-accent/30"
      aria-labelledby={`${meta.slug}-learning-summary`}
    >
      <div className="border-b border-border bg-raised/35 px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="tech-label inline-flex items-center gap-1.5 text-accent">
            <Compass className="size-3.5" strokeWidth={1.75} />
            carry this forward
          </span>
          <span className="text-fg-faint">/</span>
          <span className="font-mono text-[10px] tracking-widest text-fg-faint uppercase">
            {activityCopy[progress.activity]}
          </span>
          <span className="ml-auto font-mono text-[10px] text-fg-faint">
            {progress.done}/{progress.total} sections
          </span>
        </div>
        <h2
          id={`${meta.slug}-learning-summary`}
          className="mt-2 font-display text-xl font-semibold tracking-tight"
        >
          What should you be able to explain now?
        </h2>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-fg-muted">
          {guide.question}
        </p>
      </div>

      <div className="grid gap-px bg-border sm:grid-cols-3">
        <article className="bg-surface px-5 py-4 sm:px-6">
          <p className="tech-label mb-2 inline-flex items-center gap-1.5 text-glow-cyan">
            <FlaskConical className="size-3.5" strokeWidth={1.75} />
            what changed
          </p>
          <p className="text-sm leading-relaxed text-fg-muted">{guide.changed}</p>
        </article>
        <article className="bg-surface px-5 py-4 sm:px-6">
          <p className="tech-label mb-2 inline-flex items-center gap-1.5 text-glow-violet">
            <Lightbulb className="size-3.5" strokeWidth={1.75} />
            why it matters
          </p>
          <p className="text-sm leading-relaxed text-fg-muted">{guide.why}</p>
        </article>
        <article className="bg-surface px-5 py-4 sm:px-6">
          <p className="tech-label mb-2 inline-flex items-center gap-1.5 text-glow-green">
            <ArrowRight className="size-3.5" strokeWidth={1.75} />
            try next
          </p>
          <p className="text-sm leading-relaxed text-fg-muted">{guide.tryNext}</p>
        </article>
      </div>
    </section>
  );
}
