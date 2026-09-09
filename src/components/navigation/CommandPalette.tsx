"use client";

import { createPortal } from "react-dom";

import { useHydrated } from "@/hooks/use-hydrated";

import { IconButton } from "@/components/ui/IconButton";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import {
  allLessons,
  lessonPath,
  moduleOf,
  trackOfLesson,
} from "@/lib/curriculum";
import type { LessonMeta } from "@/curriculum/types";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

/**
 * ⌘K curriculum search.
 *
 * WHY IT EXISTS. The sidebar only ever renders the ACTIVE track, so with five
 * tracks and 49 lessons a lesson in another track is unreachable by browsing.
 * This palette is the cross-track jump: type a few letters, see the matching
 * lessons from EVERY track (title · module · track), Enter to go.
 *
 * The searchable list is derived from `allLessons` — the registry's cross-track
 * flattening, which is exactly its sanctioned use (a global index) — so a new
 * lesson appears here with no edit. Every destination is `lessonPath(lesson)`;
 * no URL is ever hand-built.
 *
 * A11Y. The dialog is `role="dialog"` + `aria-modal` with an accessible name.
 * The input is a `role="combobox"` owning the results `listbox` via
 * `aria-controls`; the active row is tracked with `aria-activedescendant`
 * pointing at a `role="option"`. Focus is trapped while open and restored to
 * the trigger on close. Result counts announce through a polite live region.
 */

/** One row of the flat, pre-computed search corpus. */
interface Entry {
  lesson: LessonMeta;
  /** Everything we match against, lower-cased once. */
  haystack: string;
  moduleTitle: string;
  trackTitle: string;
  href: string;
}

/** Built once from the registry — the module/track lookups are O(1) maps. */
const ENTRIES: Entry[] = allLessons
  .filter((lesson) => lesson.status === "available")
  .map((lesson) => {
    const moduleTitle = moduleOf(lesson).title;
    const trackTitle = trackOfLesson(lesson).title;
    return {
      lesson,
      moduleTitle,
      trackTitle,
      href: lessonPath(lesson),
      haystack:
        `${lesson.title} ${moduleTitle} ${trackTitle} ${lesson.tagline}`.toLowerCase(),
    };
  });

const LISTBOX_ID = "cmdk-listbox";
const INPUT_ID = "cmdk-input";
const optionId = (i: number) => `cmdk-option-${i}`;

/**
 * Match, then RANK by where the match landed.
 *
 * The haystack deliberately includes the tagline, so "dead" finds Circuit
 * Breakers ("the downstream is dead") as well as Deadlock. That is a useful
 * match and a terrible first result, so a title hit must outrank a tagline hit —
 * unranked registry order put Circuit Breakers first purely because track 01
 * comes before track 02.
 */
function score(entry: Entry, terms: string[]): number {
  const title = entry.lesson.title.toLowerCase();
  let best = 0;
  for (const term of terms) {
    if (title.startsWith(term)) best = Math.max(best, 4);
    else if (title.includes(term)) best = Math.max(best, 3);
    else if (`${entry.moduleTitle} ${entry.trackTitle}`.toLowerCase().includes(term))
      best = Math.max(best, 2);
    else best = Math.max(best, 1);
  }
  return best;
}

/** Substring match on the pre-lowered haystack; empty query shows everything. */
function filterEntries(query: string): Entry[] {
  const q = query.trim().toLowerCase();
  if (!q) return ENTRIES;
  // Split on whitespace so "cap dist" matches "CAP Theorem" in "Distributed".
  const terms = q.split(/\s+/);
  return ENTRIES.filter((entry) =>
    terms.every((term) => entry.haystack.includes(term)),
  )
    // Stable within a band: Array.prototype.sort is stable, so equal scores keep
    // curriculum order, which is the right tiebreak for a learning path.
    .sort((a, b) => score(b, terms) - score(a, terms));
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  // The export is static, so `document` does not exist while prerendering. The
  // repo already has one answer for "am I past hydration" — use it rather than
  // a second setState-in-effect gate, which the lint rule rightly bans.
  const mounted = useHydrated();

  // `IconButton` renders the button and does not forward a ref, so we hold the
  // wrapper and focus its button child when restoring focus on close.
  const triggerRef = useRef<HTMLSpanElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const results = useMemo(() => filterEntries(query), [query]);

  // Reset the active row whenever the query changes — done during render (the
  // documented "adjust state when a prop/value changes" pattern) rather than in
  // an effect, which would commit an extra render with a stale active index.
  const [lastQuery, setLastQuery] = useState(query);
  if (query !== lastQuery) {
    setLastQuery(query);
    setActiveIndex(0);
  }

  const close = () => {
    setOpen(false);
    setQuery("");
    setActiveIndex(0);
  };

  const go = (entry: Entry | undefined) => {
    if (!entry) return;
    close();
    router.push(entry.href);
  };

  // Global open shortcut: Cmd+K (mac) / Ctrl+K (win/linux).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // Open lifecycle: move focus into the input, trap Tab, restore focus on exit.
  useEffect(() => {
    if (!open) return;

    const trigger = triggerRef.current?.querySelector("button");
    const dialog = dialogRef.current;

    // Defer to the paint so the input exists before we focus it.
    inputRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !dialog) return;
      const focusables = dialog.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const activeEl = document.activeElement;

      if (!(activeEl instanceof HTMLElement) || !dialog.contains(activeEl)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }
      if (event.shiftKey && activeEl === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && activeEl === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      trigger?.focus();
    };
  }, [open]);

  // Keep the active option scrolled into view when navigating by keyboard.
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(
      `#${optionId(activeIndex)}`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open, results]);

  const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case "Escape":
        event.preventDefault();
        close();
        break;
      case "ArrowDown":
        event.preventDefault();
        if (results.length > 0) {
          setActiveIndex((i) => (i + 1) % results.length);
        }
        break;
      case "ArrowUp":
        event.preventDefault();
        if (results.length > 0) {
          setActiveIndex((i) => (i - 1 + results.length) % results.length);
        }
        break;
      case "Enter":
        event.preventDefault();
        go(results[activeIndex]);
        break;
    }
  };

  const count = results.length;
  const announcement = query.trim()
    ? `${count} ${count === 1 ? "lesson" : "lessons"} found`
    : `${count} ${count === 1 ? "lesson" : "lessons"}`;

  return (
    <>
      <span ref={triggerRef} className="contents">
        <IconButton
          variant="bordered"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={open}
          label="Search lessons"
          title="Search lessons  (⌘K)"
        >
          <Search className="size-4" strokeWidth={1.75} />
        </IconButton>
      </span>

      {/*
        PORTALED TO THE BODY. Rendering in place put the dialog inside the
        sidebar's <aside>, i.e. inside that element's stacking context, and page
        chrome painted straight over the results — the prose showed through the
        panel and overlapped the rows. A portal plus z-[300] (above the mobile
        header at z-40 and the skip link at z-[200]) is what actually fixes it;
        raising z-index alone cannot escape an ancestor stacking context.
      */}
      {open &&
        mounted &&
        createPortal(
          <div
            className="fixed inset-0 z-[300] flex items-start justify-center px-4 pt-[12vh]"
            role="presentation"
          >
          {/* Scrim. Click dismisses; it is decorative to AT. */}
          <div
            aria-hidden="true"
            onClick={close}
            className="absolute inset-0 bg-bg/90 backdrop-blur-md"
          />

          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Search the curriculum"
            className={cn(
              "relative flex w-full max-w-xl flex-col overflow-hidden",
              "rounded-lg border border-border-bright bg-surface shadow-2xl",
              "shadow-[0_1.5rem_4rem_-1rem_oklch(5%_0.02_255_/_90%)]",
            )}
          >
            {/* Input row: the combobox. */}
            <div className="flex items-center gap-2.5 border-b border-border px-3.5 py-3">
              <Search
                className="size-4 shrink-0 text-fg-faint"
                strokeWidth={1.75}
                aria-hidden="true"
              />
              <input
                ref={inputRef}
                id={INPUT_ID}
                type="text"
                role="combobox"
                aria-expanded="true"
                aria-controls={LISTBOX_ID}
                aria-activedescendant={
                  count > 0 ? optionId(activeIndex) : undefined
                }
                aria-label="Search the curriculum"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                placeholder="Search lessons across every track…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={onInputKeyDown}
                className={cn(
                  "min-w-0 flex-1 bg-transparent text-sm text-fg",
                  "placeholder:text-fg-faint focus:outline-none",
                )}
              />
              <span className="hidden shrink-0 font-mono text-[9px] tracking-widest text-fg-faint uppercase sm:inline">
                esc
              </span>
            </div>

            {/* Result count, announced politely; also a visible header row. */}
            <div
              role="status"
              aria-live="polite"
              className="border-b border-border px-3.5 py-1.5 font-mono text-[9px] tracking-widest text-fg-faint uppercase"
            >
              {announcement}
            </div>

            <ul
              ref={listRef}
              id={LISTBOX_ID}
              role="listbox"
              aria-label="Lessons"
              className="max-h-[52vh] overflow-y-auto overscroll-contain py-1"
            >
              {count === 0 ? (
                <li
                  role="option"
                  aria-selected="false"
                  aria-disabled="true"
                  className="px-3.5 py-6 text-center text-sm text-fg-muted"
                >
                  No lessons match “{query.trim()}”.
                </li>
              ) : (
                results.map((entry, i) => {
                  const active = i === activeIndex;
                  return (
                    <li
                      key={entry.lesson.slug}
                      id={optionId(i)}
                      role="option"
                      aria-selected={active}
                      onClick={() => go(entry)}
                      onMouseMove={() => setActiveIndex(i)}
                      className={cn(
                        "mx-1 flex cursor-pointer items-center gap-3 rounded-md px-2.5 py-2",
                        "transition-[background,color] duration-150",
                        active ? "bg-accent/10 text-fg" : "text-fg-muted",
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-fg">
                          {entry.lesson.title}
                        </span>
                        <span
                          className={cn(
                            "mt-0.5 block truncate text-xs",
                            active ? "text-fg-muted" : "text-fg-faint",
                          )}
                        >
                          {entry.moduleTitle}
                        </span>
                      </span>
                      <Badge tone={active ? "amber" : "neutral"}>
                        {entry.trackTitle}
                      </Badge>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
          </div>,
          document.body,
        )}
    </>
  );
}
