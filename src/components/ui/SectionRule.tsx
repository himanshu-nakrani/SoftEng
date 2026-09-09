import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

/**
 * The section-divider row: heading/kicker content, then a hairline rule that
 * fades at both ends and absorbs the remaining width, then optional trailing
 * marginalia pinned to the right edge.
 *
 * One implementation for the ~9 hand-rolled copies — baseline-aligned,
 * `min-w-8` rule, single gap.
 */
export function SectionRule({
  children,
  trailing,
  className,
}: {
  children: ReactNode;
  /** Right-edge content after the rule (counts, status marks). */
  trailing?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 items-baseline gap-3", className)}>
      {children}
      <span aria-hidden className="tech-rule min-w-8 flex-1" />
      {trailing}
    </div>
  );
}
