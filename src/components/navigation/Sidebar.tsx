"use client";

import { ProgressRing } from "@/components/navigation/ProgressRing";
import type { LessonMeta, Module } from "@/curriculum/types";
import { useLessonProgress } from "@/hooks/use-lesson-progress";
import { cn } from "@/lib/cn";
import { lessonPath, modules } from "@/lib/curriculum";
import { Map as MapIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

function SidebarLesson({
  lesson,
  module,
}: {
  lesson: LessonMeta;
  module: Module;
}) {
  const pathname = usePathname();
  const progress = useLessonProgress(lesson);
  const href = lessonPath(lesson);
  const active = pathname === href;
  const soon = lesson.status === "coming-soon";

  const row = (
    <span
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] transition-colors",
        active
          ? "bg-raised text-fg"
          : soon
            ? "text-fg-faint"
            : "text-fg-muted hover:bg-surface hover:text-fg",
      )}
    >
      <ProgressRing
        size={16}
        fraction={progress.fraction}
        state={progress.state}
        accent={module.accent}
      />
      <span className="truncate">{lesson.title}</span>
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
      <Link href={href}>{row}</Link>
    </li>
  );
}

/** Learn-area sidebar: logo, path link, module → lesson tree with progress. */
export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-1 overflow-y-auto border-r border-border bg-surface/50 px-3 py-5 md:flex">
      <Link href="/" className="mb-4 flex items-baseline gap-1 px-2.5">
        <span className="font-display text-lg font-bold tracking-tight">
          syslab
        </span>
        <span className="size-1.5 rounded-full bg-accent shadow-[0_0_6px_var(--color-accent)]" />
      </Link>

      <Link
        href="/learn"
        className={cn(
          "mb-3 flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] transition-colors",
          pathname === "/learn"
            ? "bg-raised text-fg"
            : "text-fg-muted hover:bg-surface hover:text-fg",
        )}
      >
        <MapIcon className="size-4" strokeWidth={1.75} />
        Learning path
      </Link>

      {modules.map((module) => (
        <nav key={module.slug} className="mb-3" aria-label={module.title}>
          <p className="tech-label mb-1.5 px-2.5">{module.title}</p>
          <ul className="flex flex-col gap-0.5">
            {module.lessons.map((lesson) => (
              <SidebarLesson
                key={lesson.slug}
                lesson={lesson}
                module={module}
              />
            ))}
          </ul>
        </nav>
      ))}

      <p className="mt-auto px-2.5 pt-4 font-mono text-[9px] tracking-widest text-fg-faint/70 uppercase">
        v0.1 · progress in localStorage
      </p>
    </aside>
  );
}
