import { cn } from "@/lib/cn";
import type { ButtonHTMLAttributes } from "react";

type Variant = "quiet" | "bordered" | "solid";
type Size = "sm" | "md";

const variants: Record<Variant, string> = {
  quiet: "text-fg-muted hover:bg-raised hover:text-fg",
  bordered:
    "border border-border bg-surface/80 backdrop-blur hover:border-border-bright hover:text-fg",
  solid: "bg-accent text-bg hover:brightness-110",
};

const sizes: Record<Size, string> = {
  sm: "size-7 rounded-md",
  md: "size-8 rounded-md",
};

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Accessible name — there is no visible text. Required on purpose. */
  label: string;
  variant?: Variant;
  size?: Size;
}

/**
 * The one square icon button. Machined control geometry (`rounded-md`, 6px),
 * hairline or bare surface per variant; every engine and page-chrome icon
 * button composes this instead of re-rolling the recipe.
 */
export function IconButton({
  label,
  variant = "quiet",
  size = "md",
  className,
  type,
  children,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type ?? "button"}
      aria-label={label}
      className={cn(
        "inline-flex cursor-pointer items-center justify-center transition-colors",
        "disabled:pointer-events-none disabled:opacity-40",
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
