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
