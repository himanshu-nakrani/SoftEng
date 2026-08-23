"use client";

import { lessonPath, nextLesson, prevLesson } from "@/lib/curriculum";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * `[` / `]` step backwards and forwards through the curriculum — the same two
 * moves `NextLessonCard` offers with the mouse, which is where they are
 * advertised (a `Kbd` chip on each link).
 *
 * Deliberately narrow:
 * - only the two bracket keys, and only unmodified — no collision with the
 *   figure-level transport shortcuts (Space / `.` / R / 1-3), which are bound
 *   on the figure element itself and never see these;
 * - typing targets are exempt, so a bracket typed into a field stays a
 *   bracket;
 * - a `coming-soon` neighbour has no route to push to, so the key does
 *   nothing rather than 404 — same rule the card renders by.
 *
 * `window` listener rather than a figure/article one: the shortcut has to work
 * with focus anywhere on the page, including the body.
 */
export function useLessonKeyboardNav(slug: string) {
  const router = useRouter();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "[" && e.key !== "]") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const target = e.target;
      if (
        target instanceof Element &&
        target.closest("input,textarea,select,[contenteditable]:not([contenteditable=false])")
      ) {
        return;
      }

      const destination = e.key === "[" ? prevLesson(slug) : nextLesson(slug);
      if (!destination || destination.status !== "available") return;

      e.preventDefault();
      router.push(lessonPath(destination));
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router, slug]);
}
