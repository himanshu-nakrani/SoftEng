import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

/** Keyboard-key styled chip for shortcuts and literal values. */
export function Kbd({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <kbd
      className={cn(
        "inline-flex items-center rounded border border-border bg-raised px-1.5 py-0.5",
        "font-mono text-[11px] text-fg-muted shadow-[0_1px_0_var(--color-border)]",
        className,
      )}
    >
      {children}
    </kbd>
  );
}
