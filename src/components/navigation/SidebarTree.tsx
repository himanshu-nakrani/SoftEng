"use client";

import { ProgressRing } from "@/components/navigation/ProgressRing";
import type { LessonMeta, Module, Track } from "@/curriculum/types";
import type { LearningActivity } from "@/hooks/use-lesson-progress";
import { useLessonProgress } from "@/hooks/use-lesson-progress";
import { cn } from "@/lib/cn";
import { accentCssVar } from "@/lib/accent";
import {
  accentOf,
  firstTrack,
  lessonPath,
  trackFromPathname,
  tracks,
  trackPath,
} from "@/lib/curriculum";
import { ChevronRight, Library, ListChecks } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

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

  return (
    <li>
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        aria-label={`${lesson.title} — ${activityLabel[progress.activity]}`}
        onClick={onNavigate}
      >
        <span
          className={cn(
            ROW,
            active
              ? "sidebar-active-row bg-raised/90 text-fg"
              : "text-fg-muted hover:translate-x-px hover:bg-surface/80 hover:text-fg",
          )}
        >
          <ProgressRing
            size={16}
            fraction={progress.fraction}
            state={progress.state}
            accent={accentOf(module)}
          />
          <span className="truncate">{lesson.title}</span>
          {progress.activity !== "untouched" && (
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
        </span>
      </Link>
    </li>
  );
}

function TrackBranch({
  track,
  pathname,
  open,
  onOpenChange,
  onNavigate,
}: {
  track: Track;
  pathname: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate?: () => void;
}) {
  const mapHref = trackPath(track);
  const onMap = pathname === mapHref;

  return (
    <details
      className="group mb-1"
      open={open}
      onToggle={(event) => {
        onOpenChange((event.currentTarget as HTMLDetailsElement).open);
      }}
    >
      <summary
        className={cn(
          ROW,
          "cursor-pointer list-none [&::-webkit-details-marker]:hidden",
          open ? "text-fg" : "text-fg-muted hover:bg-surface/80 hover:text-fg",
        )}
      >
        <ChevronRight
          className="size-3.5 shrink-0 transition-transform group-open:rotate-90"
          strokeWidth={1.75}
        />
        <span className="min-w-0 truncate">{track.title}</span>
      </summary>

      <Link
        href={mapHref}
        aria-current={onMap ? "page" : undefined}
        onClick={onNavigate}
        className={cn(
          ROW,
          "mt-0.5 pl-6",
          onMap
            ? "sidebar-active-row bg-raised/90 text-fg"
            : "text-fg-faint hover:translate-x-px hover:bg-surface/80 hover:text-fg-muted",
        )}
      >
        Track map
      </Link>

      {track.modules.map((module) => (
        <nav
          key={module.slug}
          className="sidebar-module mb-3 mt-2"
          aria-label={module.title}
          style={{ ["--module-accent" as string]: accentCssVar[accentOf(module)] }}
        >
          <p className="tech-label mb-1.5 pl-6">{module.title}</p>
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
    </details>
  );
}

/**
 * Every track as a disclosure. The active track starts open; others stay
 * shut so eleven tracks do not dump hundreds of rows. Shared by the desktop
 * sidebar and the mobile drawer.
 */
export function SidebarTree({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const current = trackFromPathname(pathname) ?? firstTrack;
  const [open, setOpen] = useState(() => new Set([current.slug]));
  const [seen, setSeen] = useState(current.slug);
  if (current.slug !== seen) {
    setSeen(current.slug);
    setOpen((prev) => new Set(prev).add(current.slug));
  }

  return (
    <>
      <Link
        href="/learn"
        aria-current={pathname === "/learn" ? "page" : undefined}
        onClick={onNavigate}
        className={cn(
          ROW,
          "mb-2 text-fg-faint hover:translate-x-px hover:bg-surface/80 hover:text-fg-muted",
        )}
      >
        <Library className="size-4" strokeWidth={1.75} />
        All tracks
      </Link>

      {tracks.map((track) => (
        <TrackBranch
          key={track.slug}
          track={track}
          pathname={pathname}
          open={open.has(track.slug)}
          onOpenChange={(nextOpen) => {
            setOpen((prev) => {
              const next = new Set(prev);
              if (nextOpen) next.add(track.slug);
              else next.delete(track.slug);
              return next;
            });
          }}
          onNavigate={onNavigate}
        />
      ))}

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
