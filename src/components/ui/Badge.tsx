import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

type Tone = "cyan" | "violet" | "amber" | "green" | "red" | "neutral";

const toneClasses: Record<Tone, string> = {
  cyan: "bg-glow-cyan-dim text-glow-cyan",
  violet: "bg-glow-violet-dim text-glow-violet",
  amber: "bg-glow-amber-dim text-glow-amber",
  green: "bg-glow-green-dim text-glow-green",
  red: "bg-glow-red-dim text-glow-red",
  neutral: "bg-raised text-fg-muted",
};

interface BadgeProps {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}

/** Small monospace chip — difficulty, est. time, prerequisite tags. */
export function Badge({ children, tone = "neutral", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5",
        "font-mono text-[11px] font-medium tracking-wide",
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
