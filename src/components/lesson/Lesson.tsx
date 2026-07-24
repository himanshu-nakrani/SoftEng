"use client";

import type { Difficulty } from "@/curriculum/types";
import { useHydrated } from "@/hooks/use-hydrated";
import { cn } from "@/lib/cn";
import { getLesson, moduleOf } from "@/lib/curriculum";
import { useProgress } from "@/stores/progress";
import type { ReactNode } from "react";
import { LessonContext } from "./context";
import { NextLessonCard } from "./NextLessonCard";

const difficultyColor: Record<Difficulty, string> = {
  foundational: "text-glow-green",
  intermediate: "text-glow-orange",
  advanced: "text-glow-violet",
};

/** Fixed right-rail mini-TOC with live checkpoint dots (xl screens). */
function CheckpointRail({ slug }: { slug: string }) {
  const meta = getLesson(slug)!;
  const hydrated = useHydrated();
  const completed = useProgress((s) => s.completedSections[slug]);
  const done = new Set(hydrated ? (completed ?? []) : []);

  return (
    <nav
      aria-label="Lesson sections"
      className="fixed top-1/2 right-6 hidden -translate-y-1/2 flex-col gap-1 xl:flex"
    >
      {meta.sections.map((section) => {
        const isDone = done.has(section.id);
        return (
          <a
            key={section.id}
            href={`#${section.id}`}
            className="group flex items-center justify-end gap-2 py-1"
          >
            <span className="font-mono text-[10px] text-fg-faint opacity-0 transition-opacity group-hover:opacity-100">
              {section.title}
            </span>
            <span
              className={cn(
                "size-2 rounded-full transition-all",
                isDone
                  ? "bg-glow-green shadow-[0_0_6px_var(--color-glow-green)]"
                  : "border border-border-bright bg-transparent group-hover:border-fg-muted",
              )}
            />
          </a>
        );
      })}
    </nav>
  );
}

interface LessonProps {
  slug: string;
  children: ReactNode;
}

/**
 * Lesson page chrome: ghost-index header, mono spec row, checkpoint rail,
 * sections, next-lesson card. Meta comes from the curriculum registry —
 * pages never restate it.
 */
export function Lesson({ slug, children }: LessonProps) {
  const meta = getLesson(slug);
  if (!meta) {
    throw new Error(`Lesson "${slug}" is not in curriculum/registry.ts`);
  }
  const mod = moduleOf(meta);
  const index = mod.lessons.findIndex((l) => l.slug === slug) + 1;
  const nn = String(index).padStart(2, "0");

  return (
    <LessonContext.Provider value={meta}>
      <article>
        <header className="relative mb-14">
          {/* ghost index numeral */}
          <span
            aria-hidden
            className="font-display pointer-events-none absolute -top-8 -left-2 text-[8rem] leading-none font-bold text-fg/[0.04] select-none"
          >
            {nn}
          </span>

          <div className="relative">
            <div className="mb-4 flex items-center gap-3">
              <span className="tech-label">{mod.title}</span>
              <div className="tech-rule flex-1" />
              <span className="tech-num text-xs text-fg-faint">
                {nn} / {String(mod.lessons.length).padStart(2, "0")}
              </span>
            </div>

            <h1 className="font-display mb-3 text-3xl font-bold tracking-tight sm:text-4xl">
              {meta.title}
            </h1>
            <p className="mb-6 max-w-xl leading-relaxed text-fg-muted">
              {meta.tagline}
            </p>

            {/* spec row — engineering drawing title block, not pill badges */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 border-y border-border py-2.5 font-mono text-[11px] tracking-wide text-fg-faint uppercase">
              <span>
                difficulty{" "}
                <span className={difficultyColor[meta.difficulty]}>
                  {meta.difficulty}
                </span>
              </span>
              <span>
                est <span className="text-fg-muted">{meta.estimatedMinutes} min</span>
              </span>
              {meta.prerequisites.length > 0 && (
                <span>
                  after{" "}
                  <span className="text-fg-muted normal-case">
                    {meta.prerequisites
                      .map((p) => getLesson(p)?.title ?? p)
                      .join(", ")}
                  </span>
                </span>
              )}
            </div>
          </div>
        </header>

        <CheckpointRail slug={slug} />
        {children}
        <NextLessonCard />
      </article>
    </LessonContext.Provider>
  );
}
