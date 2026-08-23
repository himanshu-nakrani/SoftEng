"use client";

import { ProgressRing } from "@/components/navigation/ProgressRing";
import type { LessonMeta, Module } from "@/curriculum/types";
import type { LearningActivity } from "@/hooks/use-lesson-progress";
import { useLessonProgress } from "@/hooks/use-lesson-progress";
import { cn } from "@/lib/cn";
import { accentCssVar } from "@/lib/accent";
import { lessonPath, modules } from "@/lib/curriculum";
import { ListChecks, Map as MapIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/** Shared row geometry for every navigable line in the tree. */
const ROW =
  "flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-[13px] transition-[background,color,transform] duration-150";

const activityLabel: Record<LearningActivity, string> = {
  untouched: "not started",
  explored: "explored",
  predicted: "predicted",
  complete: "complete",
  mastered: "mastered",
};

function SidebarLesson({
  lesson,
  module,
  active,
  onNavigate,
}: {
  lesson: LessonMeta;
  module: Module;
  active: boolean;
  onNavigate?: () => void;
}) {
  const progress = useLessonProgress(lesson);
  const href = lessonPath(lesson);
  const soon = lesson.status === "coming-soon";

  const row = (
    <span
      className={cn(
        ROW,
        active
          ? "sidebar-active-row bg-raised/90 text-fg"
          : soon
            ? "text-fg-faint"
            : "text-fg-muted hover:translate-x-px hover:bg-surface/80 hover:text-fg",
      )}
    >
      <ProgressRing
        size={16}
        fraction={progress.fraction}
        state={progress.state}
        accent={module.accent}
      />
      <span className="truncate">{lesson.title}</span>
      {!soon && progress.activity !== "untouched" && (
        <span
          className={cn(
            "ml-auto shrink-0 font-mono text-[9px] tracking-widest uppercase",
            progress.activity === "mastered"
              ? "text-accent"
              : "text-fg-faint",
          )}
        >
          {progress.activity === "mastered" ? "mastered" : activityLabel[progress.activity]}
        </span>
      )}
      {soon && (
        <span className="ml-auto font-mono text-[9px] tracking-widest text-fg-faint uppercase">
          soon
        </span>
      )}
    </span>
  );

  return soon ? (
    <li>{row}</li>
  ) : (
    <li>
      {/* aria-current so the active lesson is announced, not just tinted. */}
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        aria-label={`${lesson.title} — ${activityLabel[progress.activity]}`}
        onClick={onNavigate}
      >
        {row}
      </Link>
    </li>
  );
}

/**
 * The learn-area navigation body: "Learning path" link + every module →
 * lesson row with its progress ring. Registry-driven (nothing hardcoded) and
 * shared verbatim by the desktop `Sidebar` and the mobile drawer, so the two
 * can never drift.
 *
 * Renders a fragment: the parent owns the column layout (both callers are
 * `flex flex-col gap-1`).
 *
 * @param onNavigate fired when any link is activated — the drawer uses it to
 *   close itself even when the click targets the page already showing.
 */
export function SidebarTree({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const onMap = pathname === "/learn";

  return (
    <>
      <Link
        href="/learn"
        aria-current={onMap ? "page" : undefined}
        onClick={onNavigate}
        className={cn(
          ROW,
          "mb-3",
          onMap
            ? "sidebar-active-row bg-raised/90 text-fg"
            : "text-fg-muted hover:translate-x-px hover:bg-surface/80 hover:text-fg",
        )}
      >
        <MapIcon className="size-4" strokeWidth={1.75} />
        Learning path
      </Link>

      {modules.map((module) => (
        <nav
          key={module.slug}
          className="sidebar-module mb-4"
          aria-label={module.title}
          style={{ ["--module-accent" as string]: accentCssVar[module.accent] }}
        >
          <p className="tech-label mb-1.5 pl-4">{module.title}</p>
          <ul className="flex flex-col gap-0.5">
            {module.lessons.map((lesson) => (
              <SidebarLesson
                key={lesson.slug}
                lesson={lesson}
                module={module}
                active={pathname === lessonPath(lesson)}
                onNavigate={onNavigate}
              />
            ))}
          </ul>
        </nav>
      ))}

      {/* Tree footer: the track-wide practice deck. Below the modules because
          it belongs to none of them, behind a hairline so it reads as a
          different kind of destination. No `aria-current` — /review lives
          outside this layout, so this row can never be the active page while
          the tree is on screen. */}
      <div className="mt-1 border-t border-border pt-2">
        <Link
          href="/review"
          onClick={onNavigate}
          className={cn(ROW, "text-fg-muted hover:translate-x-px hover:bg-surface/80 hover:text-fg")}
        >
          <ListChecks className="size-4" strokeWidth={1.75} />
          Review deck
        </Link>
      </div>
    </>
  );
}
