import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

/**
 * Plate marginalia — the tracked-out monospace stamp that names a figure
 * (`fig · load-balancing · seed 42`), a lab, or any framed specimen.
 * Purely descriptive; always `aria-hidden` because the accessible name of
 * the thing it labels is carried by the figure/heading itself.
 */
export function PlateLabel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none font-mono text-[9px] tracking-[0.12em] text-fg-faint uppercase",
        className,
      )}
    >
      {children}
    </span>
  );
}
