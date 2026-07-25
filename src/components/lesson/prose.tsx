import { cn } from "@/lib/cn";
import { AlertTriangle, Info, Lightbulb } from "lucide-react";
import type { ReactNode } from "react";

/* Typed prose primitives — the short connective tissue between interactive
   figures. Content is 70% simulation; these keep the 30% prose consistent. */

export function P({ children }: { children: ReactNode }) {
  return (
    <p className="mb-4 text-[15px] leading-relaxed text-fg-muted">{children}</p>
  );
}

/** Opening paragraph of a lesson/section — slightly larger, brighter. */
export function Lead({ children }: { children: ReactNode }) {
  return (
    <p className="mb-4 text-[17px] leading-relaxed text-fg">{children}</p>
  );
}

/** Inline technical term — the monospace signature detail. */
export function Term({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-accent-dim px-1.5 py-0.5 font-mono text-[0.85em] text-accent">
      {children}
    </code>
  );
}

/** Emphasized inline concept (non-code). */
export function Strong({ children }: { children: ReactNode }) {
  return <strong className="font-semibold text-fg">{children}</strong>;
}

/* ---- lists ---------------------------------------------------------------
   Prose lists never use browser bullets. The site already has a vocabulary for
   marking list-like things — the checkpoint rail's dots, the landing ledger's
   mono numerals, the packet legend's swatches — and a `disc` would be the one
   un-designed glyph on the page. Markers are drawn by the LIST, not the row,
   so `LI` stays a bare semantic element and the two marker styles cannot
   drift apart.
--------------------------------------------------------------------------- */

const listMarkers = {
  /** Short accent rule — the quiet default; echoes `.tech-rule`. */
  tick: cn(
    "list-none",
    "[&>li]:relative [&>li]:pl-5",
    "[&>li]:before:absolute [&>li]:before:top-[0.68em] [&>li]:before:left-0",
    "[&>li]:before:h-px [&>li]:before:w-2.5 [&>li]:before:bg-accent",
    "[&>li]:before:content-['']",
  ),
  /** Zero-padded mono ordinal — for ordered steps; echoes the section numerals. */
  index: cn(
    "list-[decimal-leading-zero] pl-7",
    "marker:font-mono marker:text-[11px] marker:text-fg-faint",
  ),
} as const;

/**
 * Prose list. `marker="index"` numbers the rows and therefore renders a real
 * `<ol>`; the default `"tick"` renders a `<ul>`. Neither may be a flex
 * container — flex blockifies its children and `::marker` only paints on
 * `display: list-item`.
 */
export function UL({
  marker = "tick",
  children,
}: {
  marker?: keyof typeof listMarkers;
  children: ReactNode;
}) {
  const List = marker === "index" ? "ol" : "ul";
  return (
    <List
      className={cn(
        "mb-4 space-y-2 text-[15px] leading-snug text-fg-muted",
        listMarkers[marker],
      )}
    >
      {children}
    </List>
  );
}

/** One row of a `UL` — deliberately unstyled; the list owns rhythm and marker. */
export function LI({ children }: { children: ReactNode }) {
  return <li>{children}</li>;
}

/**
 * The two or three moves that make a figure say something — sits directly
 * above or below a `SectionFigure` so the instruction stops hiding inside a
 * body paragraph. Quieter than `Callout` on purpose: neutral hairline, no
 * icon, just the mono label, so a section can carry both without them
 * competing. The square markers are decorative, not checkboxes — nothing here
 * is stateful (this renders on the server), and the figure is the real record
 * of what you tried.
 */
export function TryThis({
  label = "try this",
  children,
}: {
  label?: string;
  children: ReactNode;
}) {
  return (
    <div className="my-5 rounded-md border border-border bg-surface px-4 py-3">
      <p className="tech-label mb-2 text-accent">{label}</p>
      <ul
        className={cn(
          "list-none space-y-2 text-sm leading-snug text-fg-muted",
          "[&>li]:relative [&>li]:pl-5",
          "[&>li]:before:absolute [&>li]:before:top-[0.34em] [&>li]:before:left-0",
          "[&>li]:before:size-2.5 [&>li]:before:rounded-[2px]",
          "[&>li]:before:border [&>li]:before:border-accent/45",
          "[&>li]:before:bg-accent-dim [&>li]:before:content-['']",
        )}
      >
        {children}
      </ul>
    </div>
  );
}

/**
 * Side-by-side tradeoff: exactly two `CompareCol` children, a hairline between
 * them, stacked to one column on narrow screens.
 *
 * Columns take a mono title plus free prose rather than parallel attribute
 * rows. The tradeoffs this site argues (vertical vs horizontal, CP vs AP) are
 * already sentences in the lesson, not a matrix of fields — a rows API would
 * force inventing row labels and rewriting the prose to fit them.
 */
export function Compare({ children }: { children: ReactNode }) {
  return (
    <div
      className={cn(
        "my-6 grid grid-cols-1 gap-y-5 sm:grid-cols-2 sm:gap-x-6 sm:gap-y-0",
        // The divider belongs to whichever column follows another: a top
        // hairline while stacked, a left hairline once side by side.
        "[&>*+*]:border-t [&>*+*]:border-border [&>*+*]:pt-5",
        "sm:[&>*+*]:border-t-0 sm:[&>*+*]:border-l sm:[&>*+*]:pt-0 sm:[&>*+*]:pl-6",
      )}
    >
      {children}
    </div>
  );
}

/** One side of a `Compare`. The header row echoes the section title rule. */
export function CompareCol({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-3">
        <span className="tech-label text-accent">{title}</span>
        <div className="tech-rule min-w-6 flex-1" />
      </div>
      <div className="text-sm leading-relaxed text-fg-muted [&>*:last-child]:mb-0">
        {children}
      </div>
    </div>
  );
}

const calloutStyles = {
  insight: {
    icon: Lightbulb,
    border: "border-glow-cyan/40",
    text: "text-glow-cyan",
    label: "insight",
  },
  warning: {
    icon: AlertTriangle,
    border: "border-glow-orange/40",
    text: "text-glow-orange",
    label: "watch out",
  },
  note: {
    icon: Info,
    border: "border-glow-violet/40",
    text: "text-glow-violet",
    label: "note",
  },
} as const;

export function Callout({
  kind = "insight",
  children,
}: {
  kind?: keyof typeof calloutStyles;
  children: ReactNode;
}) {
  const style = calloutStyles[kind];
  const Icon = style.icon;
  return (
    <aside
      className={cn(
        "my-5 rounded-md border bg-surface px-4 py-3",
        style.border,
      )}
    >
      <p className={cn("tech-label mb-1.5 flex items-center gap-1.5", style.text)}>
        <Icon className="size-3.5" />
        {style.label}
      </p>
      <div className="text-sm leading-relaxed text-fg-muted">{children}</div>
    </aside>
  );
}
