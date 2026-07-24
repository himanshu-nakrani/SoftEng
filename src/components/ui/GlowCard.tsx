import { cn } from "@/lib/cn";
import type { CSSProperties, ReactNode } from "react";

type Accent = "cyan" | "violet" | "amber" | "green" | "red";

const accentVar: Record<Accent, string> = {
  cyan: "var(--color-glow-cyan)",
  violet: "var(--color-glow-violet)",
  amber: "var(--color-glow-amber)",
  green: "var(--color-glow-green)",
  red: "var(--color-glow-red)",
};

interface GlowCardProps {
  children: ReactNode;
  accent?: Accent;
  /** Always-on glow ring instead of hover-only. */
  active?: boolean;
  className?: string;
}

/**
 * Surface card with hairline border; glows in its accent color on hover
 * (or persistently when `active`). The workhorse container of the site.
 */
export function GlowCard({
  children,
  accent = "amber",
  active = false,
  className,
}: GlowCardProps) {
  return (
    <div
      style={{ "--glow-color": accentVar[accent] } as CSSProperties}
      className={cn(
        "rounded-lg border border-border bg-surface transition-all duration-300",
        active
          ? "glow-ring border-transparent"
          : "hover:border-border-bright hover:shadow-[0_0_32px_-12px_var(--glow-color)]",
        className,
      )}
    >
      {children}
    </div>
  );
}
