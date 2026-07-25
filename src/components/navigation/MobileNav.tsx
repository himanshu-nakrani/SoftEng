"use client";

import { ProgressRing } from "@/components/navigation/ProgressRing";
import { SidebarTree } from "@/components/navigation/SidebarTree";
import type { LessonMeta } from "@/curriculum/types";
import { useHydrated } from "@/hooks/use-hydrated";
import { useLessonProgress } from "@/hooks/use-lesson-progress";
import { allLessons, lessonPath, moduleOf } from "@/lib/curriculum";
import { Menu, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { Transition } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const DRAWER_ID = "mobile-nav-drawer";

/** Tab-order members inside the panel. Kept in one place for the trap. */
const FOCUSABLE =
  'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Tailwind's `md` — where the desktop sidebar takes over from the drawer. */
const DESKTOP_QUERY = "(min-width: 48rem)";

/** Matches --ease-out-soft; springs would overshoot past the left edge. */
const SLIDE: Transition = { duration: 0.26, ease: [0.22, 1, 0.36, 1] };
const FADE: Transition = { duration: 0.16, ease: "linear" };
/** Reduced motion: the panel appears, it doesn't travel. */
const INSTANT: Transition = { duration: 0.12, ease: "linear" };

/**
 * Mobile navigation: a menu button plus a slide-over drawer carrying the same
 * registry-driven `SidebarTree` the desktop sidebar renders — so a phone user
 * inside a lesson can still see every module, sibling lesson and progress ring.
 *
 * The drawer is portalled to `document.body` on purpose: the mobile top bar
 * sets `backdrop-blur`, and a backdrop filter makes an element the containing
 * block for `position: fixed` descendants — a drawer rendered inside the bar
 * would be trapped in the bar's box.
 */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const hydrated = useHydrated();
  const pathname = usePathname();
  const reduced = useReducedMotion();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Navigating always dismisses the drawer (links inside it also call close()
  // directly, which covers a tap on the lesson already open).
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Everything an open drawer owns: scroll lock, focus trap, Escape, the
  // breakpoint escape hatch, and focus restoration on the way out.
  useEffect(() => {
    if (!open) return;

    const panel = panelRef.current;
    const trigger = triggerRef.current;
    const body = document.body;

    // Scroll lock. `overflow: hidden` on <body> propagates to the viewport
    // while <html> stays `visible`, so the page underneath cannot scroll and
    // its scroll position is preserved. The previous inline value is restored
    // rather than blanked, so we never clobber someone else's lock.
    const prevOverflow = body.style.overflow;
    body.style.overflow = "hidden";

    const focusables = () =>
      Array.from(panel?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);

    // Move focus into the panel: its first link (the wordmark), so the very
    // next Tab walks the tree.
    focusables()[0]?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab" || !panel) return;

      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      // Focus escaped the panel (e.g. a tap on the scrim left it on <body>):
      // pull it back to whichever end the user is heading for.
      if (!(active instanceof HTMLElement) || !panel.contains(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);

    // Resizing past md hides the drawer (md:hidden) while the page stays
    // locked — close it so the scroll lock can never outlive its UI.
    const desktop = window.matchMedia(DESKTOP_QUERY);
    const onBreakpoint = () => {
      if (desktop.matches) setOpen(false);
    };
    desktop.addEventListener("change", onBreakpoint);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      desktop.removeEventListener("change", onBreakpoint);
      body.style.overflow = prevOverflow;
      trigger?.focus();
    };
  }, [open]);

  const close = () => setOpen(false);

  const panelMotion = reduced
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: INSTANT,
      }
    : {
        initial: { x: "-100%" },
        animate: { x: 0 },
        exit: { x: "-100%" },
        transition: SLIDE,
      };

  // Both animated elements are DIRECT keyed children of AnimatePresence —
  // wrapping them in a fragment would hand it one unkeyed child to track.
  const drawer = (
    <AnimatePresence>
      {open && (
        <motion.div
          key="scrim"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={FADE}
          onClick={close}
          aria-hidden="true"
          className="fixed inset-0 z-50 bg-bg/75 backdrop-blur-sm md:hidden"
        />
      )}
      {open && (
        <motion.div
          key="panel"
          ref={panelRef}
          id={DRAWER_ID}
          role="dialog"
          aria-modal="true"
          aria-label="Site navigation"
          {...panelMotion}
          className="fixed inset-y-0 left-0 z-50 flex w-[17.5rem] max-w-[85vw] flex-col border-r border-border bg-surface shadow-2xl md:hidden"
        >
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <Link href="/" onClick={close} className="flex items-baseline gap-1">
              <span className="font-display text-lg font-bold tracking-tight">
                syslab
              </span>
              <span className="size-1.5 rounded-full bg-accent shadow-[0_0_6px_var(--color-accent)]" />
            </Link>
            <button
              type="button"
              onClick={close}
              aria-label="Close navigation"
              className="ml-auto flex size-8 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-raised hover:text-fg"
            >
              <X className="size-4.5" strokeWidth={1.75} />
            </button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain px-3 py-4">
            <SidebarTree onNavigate={close} />
          </div>

          <p className="border-t border-border px-4 py-3 font-mono text-[9px] tracking-widest text-fg-faint/70 uppercase">
            v0.1 · progress in localStorage
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={DRAWER_ID}
        aria-label="Navigation menu"
        className="-ml-1.5 flex size-9 shrink-0 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-surface hover:text-fg"
      >
        <Menu className="size-5" strokeWidth={1.75} />
      </button>

      {/* Portalled only after mount: the static HTML has no document. */}
      {hydrated && createPortal(drawer, document.body)}
    </>
  );
}

/**
 * Right side of the mobile top bar: the lesson you're in (title + its progress
 * ring), or the map link anywhere else. Pathname-matched against the registry,
 * so new lessons need no change here.
 */
export function MobileCurrentLesson() {
  const pathname = usePathname();
  const lesson = allLessons.find((item) => lessonPath(item) === pathname);

  if (!lesson) {
    return (
      <Link
        href="/learn"
        aria-current={pathname === "/learn" ? "page" : undefined}
        className="ml-auto shrink-0 text-sm text-fg-muted transition-colors hover:text-fg"
      >
        Learning path
      </Link>
    );
  }

  return <CurrentLessonLabel lesson={lesson} />;
}

function CurrentLessonLabel({ lesson }: { lesson: LessonMeta }) {
  const progress = useLessonProgress(lesson);

  return (
    <span
      aria-current="page"
      className="ml-auto flex min-w-0 items-center gap-2"
    >
      <ProgressRing
        size={14}
        fraction={progress.fraction}
        state={progress.state}
        accent={moduleOf(lesson).accent}
      />
      <span className="truncate text-sm text-fg">{lesson.title}</span>
    </span>
  );
}
