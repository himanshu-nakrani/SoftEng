import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

type Tone = "cyan" | "violet" | "amber" | "green" | "red" | "neutral";

/**
 * Chrome color budget: tone colors the TEXT and the tick only, never a tinted
 * fill — on this ground, hierarchy comes from luminance, not from washes.
 */
const toneClasses: Record<Tone, string> = {
  cyan: "text-glow-cyan",
  violet: "text-glow-violet",
  amber: "text-accent",
  green: "text-glow-green",
  red: "text-glow-red",
  neutral: "text-fg-muted",
};

interface BadgeProps {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}

/**
 * Tick-tag: the square-cornered monospace chip (difficulty, est. time,
 * prerequisite tags). A small leading mark carries the tone; the hairline
 * border keeps it plate-like instead of pill-like.
 */
export function Badge({ children, tone = "neutral", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border border-border bg-raised px-2 py-0.5",
        "font-mono text-[11px] tracking-wide",
        toneClasses[tone],
        className,
      )}
    >
      <span aria-hidden className="size-1 bg-current opacity-80" />
      {children}
    </span>
  );
}
