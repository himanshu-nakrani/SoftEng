import { cn } from "@/lib/cn";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "ghost" | "outline";
type Size = "sm" | "md";

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-accent text-bg font-semibold hover:brightness-110",
  ghost: "text-fg-muted hover:text-fg hover:bg-raised",
  outline:
    "border border-border text-fg-muted hover:border-border-bright hover:text-fg",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-10 px-5 text-sm gap-2",
};

/**
 * The class recipe, exported so router `<Link>`s can wear the exact same
 * geometry as `<Button>` — the hero CTA pair is a Link beside a Link-shaped
 * button, and they must not drift.
 */
export function buttonClasses(
  variant: Variant = "outline",
  size: Size = "md",
  className?: string,
) {
  return cn(
    "inline-flex cursor-pointer items-center justify-center rounded-md font-medium transition-all duration-200",
    "disabled:pointer-events-none disabled:opacity-40",
    variantClasses[variant],
    sizeClasses[size],
    className,
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({
  variant = "outline",
  size = "md",
  className,
  type,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type ?? "button"}
      className={buttonClasses(variant, size, className)}
      {...props}
    />
  );
}
