"use client";

import { ProgressRing } from "@/components/navigation/ProgressRing";
import { GlowCard } from "@/components/ui/GlowCard";
import type { Difficulty, LessonMeta, Module } from "@/curriculum/types";
import { useHydrated } from "@/hooks/use-hydrated";
import { useLessonProgress } from "@/hooks/use-lesson-progress";
import { cn } from "@/lib/cn";
import { getLesson, lessonPath, modules } from "@/lib/curriculum";
import { useProgress } from "@/stores/progress";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

const difficultyColor: Record<Difficulty, string> = {
  foundational: "text-glow-green",
  intermediate: "text-glow-orange",
  advanced: "text-glow-violet",
};

const accentVar: Record<Module["accent"], string> = {
  cyan: "var(--color-glow-cyan)",
  violet: "var(--color-glow-violet)",
  amber: "var(--color-glow-amber)",
  green: "var(--color-glow-green)",
  red: "var(--color-glow-red)",
};

/** "Continue where you left off" card, from persisted lastVisited. */
function ContinueCard() {
  const hydrated = useHydrated();
  const lastVisited = useProgress((s) => s.lastVisited);
  if (!hydrated || !lastVisited) return null;

  const lesson = getLesson(lastVisited.lessonSlug);
  if (!lesson || lesson.status !== "available") return null;

  return (
    <Link href={lessonPath(lesson)} className="group block">
      <GlowCard active className="mb-12 flex items-center gap-4 px-5 py-4">
        <div>
          <p className="tech-label mb-0.5">Continue where you left off</p>
          <p className="font-display text-lg font-semibold">{lesson.title}</p>
        </div>
        <ArrowRight className="ml-auto size-5 text-accent transition-transform group-hover:translate-x-1" />
      </GlowCard>
    </Link>
  );
}

function MapNode({
  lesson,
  module: mod,
  index,
}: {
  lesson: LessonMeta;
  module: Module;
  index: number;
}) {
  const progress = useLessonProgress(lesson);
  const soon = lesson.status === "coming-soon";

  const row = (
    <div
      className={cn(
        "flex-1 rounded-md border border-transparent px-4 py-3.5 transition-all",
        soon
          ? "opacity-40"
          : "group-hover:border-border-bright group-hover:bg-surface/60",
      )}
    >
      <div className="mb-1 flex items-baseline gap-2.5">
        <span className="tech-num text-[11px] text-fg-faint">
          {String(index).padStart(2, "0")}
        </span>
        <h3 className="font-display text-base font-semibold">
          {lesson.title}
        </h3>
        {soon && (
          <span className="font-mono text-[9px] tracking-widest text-fg-faint uppercase">
            coming soon
          </span>
        )}
        {!soon && (
          <ArrowRight className="ml-auto size-3.5 shrink-0 text-fg-faint opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
        )}
      </div>
      <p className="mb-2 text-sm leading-relaxed text-fg-muted">
        {lesson.tagline}
      </p>
      <p className="font-mono text-[11px] tracking-wide text-fg-faint">
        <span className={difficultyColor[lesson.difficulty]}>
          {lesson.difficulty}
        </span>
        {" · "}
        {lesson.estimatedMinutes} min
        {lesson.prerequisites.length > 0 && (
          <span>
            {" · after "}
            {lesson.prerequisites
              .map((p) => getLesson(p)?.title ?? p)
              .join(", ")}
          </span>
        )}
      </p>
    </div>
  );

  return (
    <li className="relative flex gap-4 pb-2">
      {/* spine node */}
      <div className="flex flex-col items-center pt-4">
        <ProgressRing
          size={22}
          fraction={progress.fraction}
          state={progress.state}
          accent={mod.accent}
        />
        <div className="mt-2 w-px flex-1 bg-border" />
      </div>
      {soon ? (
        <div className="flex flex-1">{row}</div>
      ) : (
        <Link href={lessonPath(lesson)} className="group flex flex-1">
          {row}
        </Link>
      )}
    </li>
  );
}

/** The learning-path map: module clusters on a progress spine. */
export function LessonMap() {
  return (
    <div className="relative">
      <div className="dot-grid dot-grid-fade pointer-events-none absolute inset-0 -z-10" />
      <ContinueCard />

      {modules.map((mod, i) => (
        <section key={mod.slug} className="mb-12">
          <div className="mb-5 flex items-center gap-3">
            <span
              className="size-1.5 rounded-full"
              style={{
                background: accentVar[mod.accent],
                boxShadow: `0 0 8px ${accentVar[mod.accent]}`,
              }}
            />
            <span className="tech-num text-xs text-fg-faint">
              mod.{String(i + 1).padStart(2, "0")}
            </span>
            <h2 className="font-display text-xl font-bold">{mod.title}</h2>
            <div className="tech-rule min-w-8 flex-1" />
            <span className="hidden font-mono text-[11px] text-fg-faint sm:inline">
              {mod.description}
            </span>
          </div>

          <ul className="ml-1">
            {mod.lessons.map((lesson, li) => (
              <MapNode
                key={lesson.slug}
                lesson={lesson}
                module={mod}
                index={li + 1}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
