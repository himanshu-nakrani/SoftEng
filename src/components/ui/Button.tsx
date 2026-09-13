import { cn } from "@/lib/cn";
import { forwardRef, type ButtonHTMLAttributes } from "react";

type Variant = "primary" | "ghost" | "outline";
type Size = "sm" | "md";

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-accent text-bg font-semibold shadow-xs hover:brightness-110 hover:shadow-sm",
  ghost: "text-fg-muted hover:text-fg hover:bg-raised",
  outline:
    "border border-border bg-surface/40 text-fg-muted hover:border-border-bright hover:bg-raised hover:text-fg",
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
    "inline-flex cursor-pointer items-center justify-center rounded-md font-medium",
    "transition-[background-color,border-color,color,box-shadow,filter,transform] duration-150 ease-[var(--ease-out-soft)]",
    "active:scale-[0.98]",
    "disabled:pointer-events-none disabled:opacity-40 disabled:active:scale-100",
    variantClasses[variant],
    sizeClasses[size],
    className,
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { variant = "outline", size = "md", className, type, ...props },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type ?? "button"}
        className={buttonClasses(variant, size, className)}
        {...props}
      />
    );
  },
);
