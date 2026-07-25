"use client";

import { useCallback, useEffect, useRef } from "react";
import { useProgress } from "@/stores/progress";
import { LessonContext, SectionCompletionContext } from "./context";
import { useContext } from "react";

const CONCEPT_DWELL_MS = 2000;

interface LessonSectionProps {
  id: string;
  children: React.ReactNode;
}

/**
 * One checkpoint of a lesson. Looks up its own title/kind from the registry
 * (via LessonContext) and wires completion:
 * - concept: viewport dwell (≥35% visible for 2s)
 * - interactive / quiz: explicit completion from the embedded widget via
 *   SectionCompletionContext
 * Also records lastVisited for the "continue" affordance.
 */
export function LessonSection({ id, children }: LessonSectionProps) {
  const meta = useContext(LessonContext);
  if (!meta) throw new Error("LessonSection must be used inside <Lesson>");
  const section = meta.sections.find((s) => s.id === id);
  if (!section) {
    throw new Error(
      `Section "${id}" is not registered for lesson "${meta.slug}" — add it to curriculum/registry.ts`,
    );
  }

  const ref = useRef<HTMLElement>(null);
  const completeSection = useProgress((s) => s.completeSection);
  const setLastVisited = useProgress((s) => s.setLastVisited);

  const markComplete = useCallback(() => {
    completeSection(meta.slug, id);
  }, [completeSection, meta.slug, id]);

  // Visibility: lastVisited always; dwell-completion for concept sections.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let inView = false;

    const cancelDwell = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };
    const startDwell = () => {
      // A backgrounded tab must not farm completions.
      if (timer || section.kind !== "concept") return;
      if (document.visibilityState !== "visible") return;
      timer = setTimeout(markComplete, CONCEPT_DWELL_MS);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        // A section taller than ~2.8 viewports can never reach 35% visible,
        // so "fills most of the viewport" counts as in-view too.
        inView =
          entry.intersectionRatio >= 0.35 ||
          entry.intersectionRect.height >= 0.6 * window.innerHeight;
        if (inView) {
          setLastVisited(meta.slug, id);
          startDwell();
        } else {
          cancelDwell();
        }
      },
      { threshold: [0, 0.15, 0.35] },
    );
    observer.observe(el);

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        if (inView) startDwell();
      } else {
        cancelDwell();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      cancelDwell();
    };
  }, [id, meta.slug, section.kind, markComplete, setLastVisited]);

  const index = meta.sections.findIndex((s) => s.id === id) + 1;

  return (
    <SectionCompletionContext.Provider value={markComplete}>
      <section ref={ref} id={id} className="mb-14 scroll-mt-24">
        <div className="mb-4 flex items-baseline gap-3">
          <span className="tech-num text-xs text-fg-faint">
            {String(index).padStart(2, "0")}
          </span>
          <h2 className="font-display text-xl font-bold tracking-tight">
            {section.title}
          </h2>
          <div className="tech-rule min-w-8 flex-1" />
        </div>
        {children}
      </section>
    </SectionCompletionContext.Provider>
  );
}
