import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

/**
 * The section-divider row: a `tech-label` kicker (or any heading content)
 * followed by a hairline rule that fades at both ends and absorbs the
 * remaining width. One implementation for the ~9 hand-rolled copies —
 * baseline-aligned, `min-w-8` rule, single gap.
 */
export function SectionRule({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-baseline gap-3 [&>*]:shrink-0",
        className,
      )}
    >
      {children}
      <span aria-hidden className="tech-rule min-w-8 flex-1" />
    </div>
  );
}
