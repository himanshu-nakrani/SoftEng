"use client";

import { ProgressRing } from "@/components/navigation/ProgressRing";
import type { LessonMeta } from "@/curriculum/types";
import { useHydrated } from "@/hooks/use-hydrated";
import { useLessonProgress } from "@/hooks/use-lesson-progress";
import { cn } from "@/lib/cn";
import { getLesson, lessonPath, moduleOf } from "@/lib/curriculum";
import { useProgress } from "@/stores/progress";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

/** The hero's primary button shape — shared so the swap can't drift. */
const CTA =
  "flex items-center gap-2 rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink transition-all hover:shadow-[0_0_28px_-6px_var(--color-accent)] hover:brightness-110";

/**
 * The pre-hydration / first-visit CTA. This is the markup that ships in the
 * static HTML, so it must render identically on the server and on the client's
 * hydration pass — hence no store reads anywhere in this subtree.
 */
function StartCta() {
  return (
    <Link href="/learn" className={CTA}>
      Start the track
      <ArrowRight className="size-4" />
    </Link>
  );
}

/**
 * Mounted only once we know a lesson to continue, so `useLessonProgress` is
 * never called with a placeholder.
 */
function ContinueButton({
  lesson,
  sectionId,
}: {
  lesson: LessonMeta;
  sectionId: string;
}) {
  const progress = useLessonProgress(lesson);

  // Only deep-link to a section the registry still has — a renamed section id
  // would scroll nowhere. (Lesson sections carry ids + scroll-mt.)
  const section = lesson.sections.find((sec) => sec.id === sectionId);
  const href = section
    ? `${lessonPath(lesson)}#${section.id}`
    : lessonPath(lesson);

  return (
    <Link
      href={href}
      className={cn(CTA, "group max-w-full")}
      title={
        section
          ? `Continue: ${lesson.title} — ${section.title}`
          : `Continue: ${lesson.title}`
      }
    >
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-bg/85">
        <ProgressRing
          size={14}
          fraction={progress.fraction}
          state={progress.state}
          mastered={progress.mastered}
          accent={moduleOf(lesson).accent}
        />
      </span>
      <span className="min-w-0 truncate">Continue · {lesson.title}</span>
      <ArrowRight className="size-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

/**
 * Hero CTA. New visitors (and every server-rendered byte) get "Start the
 * track"; returning ones get their last lesson back, but only after mount —
 * `useHydrated` is false during the hydration render, so the client's first
 * pass reproduces the static HTML exactly and the swap happens in the commit
 * after it.
 */
export function ContinueCta() {
  const hydrated = useHydrated();
  const lastVisited = useProgress((s) => s.lastVisited);

  if (!hydrated || !lastVisited) return <StartCta />;

  const lesson = getLesson(lastVisited.lessonSlug);
  if (!lesson || lesson.status !== "available") return <StartCta />;

  return (
    <ContinueButton lesson={lesson} sectionId={lastVisited.sectionId} />
  );
}
