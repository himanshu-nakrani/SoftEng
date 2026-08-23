"use client";

import type { LessonMeta } from "@/curriculum/types";
import { learningLinks } from "@/curriculum/learning";
import { ArrowUpRight, GitBranch } from "lucide-react";
import Link from "next/link";

/** Concept neighborhood for building a systems mental model across lessons. */
export function LearningConnections({ meta }: { meta: LessonMeta }) {
  const links = learningLinks(meta.slug);
  if (links.length === 0) return null;

  return (
    <section
      className="surface-card mb-12 px-5 py-5 sm:px-6"
      aria-labelledby={`${meta.slug}-connections`}
    >
      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="tech-label inline-flex items-center gap-1.5 text-glow-violet">
          <GitBranch className="size-3.5" strokeWidth={1.75} />
          concept neighborhood
        </span>
        <span className="text-fg-faint">/</span>
        <span className="font-mono text-[10px] tracking-widest text-fg-faint uppercase">
          the path is connected
        </span>
      </div>
      <h2 id={`${meta.slug}-connections`} className="font-display text-xl font-semibold tracking-tight">
        Where this idea goes next
      </h2>
      <p className="mt-1 max-w-2xl text-sm leading-relaxed text-fg-muted">
        Revisit the neighboring mechanism when you want to compare the same
        pressure at a different layer of the system.
      </p>
      <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {links.map(({ lesson, relation, href }) => (
          <Link
            key={lesson.slug}
            href={href}
            className="group flex min-h-16 items-center justify-between gap-3 rounded-lg border border-border bg-raised/45 px-3.5 py-3 transition-colors hover:border-border-bright hover:bg-raised"
          >
            <span className="min-w-0">
              <span className="block font-mono text-[9px] tracking-widest text-fg-faint uppercase">
                {relation}
              </span>
              <span className="mt-0.5 block truncate font-display text-sm font-semibold text-fg">
                {lesson.title}
              </span>
            </span>
            <ArrowUpRight
              className="size-4 shrink-0 text-accent transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              strokeWidth={1.75}
            />
          </Link>
        ))}
      </div>
    </section>
  );
}
