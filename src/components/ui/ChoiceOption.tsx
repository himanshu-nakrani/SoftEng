import { cn } from "@/lib/cn";
import { Check, X } from "lucide-react";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

interface ChoiceOptionProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** The prediction has been committed; options become a verdict. */
  revealed?: boolean;
  /** This option is the one the learner picked. */
  chosen?: boolean;
  /** This option is the correct choice (shown only once revealed). */
  correct?: boolean;
  children: ReactNode;
}

/**
 * One prediction option. Used by the in-sim checkpoint and the review deck
 * so the two cannot drift: reserved mark slot (no layout shift on reveal),
 * plate radius, chrome hover (not a hue wash), green/red only as verdict.
 */
export const ChoiceOption = forwardRef<HTMLButtonElement, ChoiceOptionProps>(
  function ChoiceOption(
    {
      revealed = false,
      chosen = false,
      correct = false,
      className,
      children,
      disabled,
      type,
      ...rest
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type ?? "button"}
        disabled={disabled ?? revealed}
        className={cn(
          "relative flex min-h-10 w-full cursor-pointer items-center gap-2.5 rounded-sm border px-3 py-2 text-left text-sm",
          "transition-[background-color,border-color,color,box-shadow,opacity] duration-150 ease-[var(--ease-out-soft)]",
          "focus-visible:[outline-offset:-2px]",
          !revealed &&
            "border-border bg-surface/50 hover:border-border-bright hover:bg-raised",
          revealed &&
            correct &&
            "border-glow-green/60 bg-glow-green-dim text-glow-green",
          revealed &&
            chosen &&
            !correct &&
            "border-glow-red/60 bg-glow-red-dim text-glow-red",
          revealed &&
            !chosen &&
            !correct &&
            "border-border bg-transparent text-fg-muted opacity-50",
          revealed && "cursor-default",
          className,
        )}
        {...rest}
      >
        <span
          aria-hidden
          className={cn(
            "flex size-4 shrink-0 items-center justify-center rounded-[3px] border transition-colors duration-150",
            !revealed && "border-border-bright bg-bg/50",
            revealed && correct && "border-glow-green/70 bg-glow-green-dim",
            revealed &&
              chosen &&
              !correct &&
              "border-glow-red/70 bg-glow-red-dim",
            revealed && !chosen && !correct && "border-border",
          )}
        >
          {revealed && correct && (
            <Check className="size-3" strokeWidth={2.5} />
          )}
          {revealed && chosen && !correct && (
            <X className="size-3" strokeWidth={2.5} />
          )}
        </span>
        <span className="min-w-0 flex-1">{children}</span>
      </button>
    );
  },
);
