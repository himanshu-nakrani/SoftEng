import { ThemeToggle } from "@/components/navigation/ThemeToggle";
import { cn } from "@/lib/cn";
import Link from "next/link";
import type { ReactNode } from "react";

/** Container widths — the only two horizontal rhythms on the site. */
const widths = {
  read: "max-w-3xl",
  app: "max-w-6xl",
} as const;

export type SiteWidth = keyof typeof widths;

/** The wordmark: display voice, one accent pip, one link home. */
export function Wordmark({
  className,
  onClick,
}: {
  className?: string;
  /** Pass-through for chrome that must close itself on navigate (drawer). */
  onClick?: () => void;
}) {
  return (
    <Link
      href="/"
      onClick={onClick}
      className={cn("flex w-fit items-baseline gap-1", className)}
      aria-label="syslab — home"
    >
      <span className="font-display text-lg font-bold tracking-tight">
        syslab
      </span>
      <span
        aria-hidden
        className="size-1.5 rounded-full bg-accent shadow-[0_0_6px_var(--color-accent)]"
      />
    </Link>
  );
}

/**
 * Shared page chrome for routes outside the learn layout. One header/footer,
 * one wordmark, one container rhythm (`read` | `app`) aligned with the page's
 * own container — previously every standalone page re-implemented this block
 * at its own width.
 */
export function SiteHeader({
  nav,
  width = "app",
  className,
}: {
  /** Right-aligned navigation content. */
  nav?: ReactNode;
  width?: SiteWidth;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "mx-auto flex w-full items-center justify-between px-6 py-5",
        widths[width],
        className,
      )}
    >
      <Wordmark />
      <nav aria-label="Site" className="flex items-center gap-5">
        {nav}
        <ThemeToggle />
      </nav>
    </header>
  );
}

export function SiteFooter({
  children,
  width = "app",
  className,
}: {
  /** Free-form row content — callers own their left/right split. */
  children?: ReactNode;
  width?: SiteWidth;
  className?: string;
}) {
  return (
    <footer
      className={cn(
        "mx-auto w-full px-6 py-8",
        widths[width],
        className,
      )}
    >
      <div aria-hidden className="tech-rule mb-6" />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        {children}
      </div>
    </footer>
  );
}
