"use client";

import { cn } from "@/lib/cn";
import { useRef, type KeyboardEvent, type ReactNode } from "react";

export interface SegmentedOption<T extends string | number> {
  value: T;
  label: ReactNode;
  /** Accessible name override when the visible label is too terse ("0.5x"). */
  ariaLabel?: string;
}

interface SegmentedControlProps<T extends string | number> {
  options: SegmentedOption<T>[];
  /** Selected value; if it matches no option the first segment holds the tab stop. */
  value: T | undefined;
  onChange: (value: T) => void;
  /** Required: the group has no visible <label> to be tied to. */
  ariaLabel: string;
  /**
   * Chrome scale. "sm" = transport-bar chrome (quieter, tighter); "md" = the
   * control panel's parameter switcher. The two callers' visuals are frozen
   * here so they cannot drift apart.
   */
  size?: "sm" | "md";
  className?: string;
}

const groupSize = { sm: "rounded-md", md: "rounded-lg" } as const;
const itemSize = {
  sm: "px-2 py-0.5 text-[10px]",
  md: "px-2.5 py-1 text-[11px]",
} as const;
const idleTone = {
  sm: "text-fg-faint hover:text-fg-muted",
  md: "text-fg-muted hover:bg-raised hover:text-fg",
} as const;

/**
 * One-of-N switcher built to the WAI-ARIA radio-group pattern:
 *
 * - the group is a single tab stop (roving tabindex — the checked segment
 *   carries `tabindex=0`, every other segment `-1`);
 * - Arrow Right/Down → next, Arrow Left/Up → previous, both wrapping;
 *   Home/End → first/last;
 * - selection follows focus, so arrowing *is* choosing (this is what the
 *   pattern prescribes for radios, and both call sites are instant-apply);
 * - Space/Enter on a focused segment selects it (native `<button>` activation).
 *
 * Used by the transport bar (speed) and the control panel (select params).
 */
export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  ariaLabel,
  size = "md",
  className,
}: SegmentedControlProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const selectedIndex = options.findIndex((opt) => opt.value === value);

  /** Arrowing moves focus AND selection — the radio pattern's contract. */
  const focusAndSelect = (index: number) => {
    const opt = options[index];
    if (!opt) return;
    refs.current[index]?.focus();
    if (opt.value !== value) onChange(opt.value);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = refs.current.indexOf(event.target as HTMLButtonElement);
    if (current === -1) return;
    const last = options.length - 1;
    let next: number;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        next = current === last ? 0 : current + 1;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        next = current === 0 ? last : current - 1;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = last;
        break;
      default:
        return;
    }
    event.preventDefault();
    focusAndSelect(next);
  };

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className={cn(
        "flex overflow-hidden border border-border",
        groupSize[size],
        className,
      )}
    >
      {options.map((opt, i) => {
        const selected = i === selectedIndex;
        return (
          <button
            key={String(opt.value)}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={opt.ariaLabel}
            // Nothing checked yet ⇒ the first segment holds the tab stop, so
            // the group is always reachable with exactly one Tab.
            tabIndex={selected || (selectedIndex === -1 && i === 0) ? 0 : -1}
            onClick={() => onChange(opt.value)}
            className={cn(
              "cursor-pointer font-mono transition-colors",
              // The group clips overflow (shared rounded corners), which would
              // eat an outset focus ring — pull it inside the segment.
              "focus-visible:[outline-offset:-2px]",
              itemSize[size],
              selected ? "bg-accent-dim text-accent" : idleTone[size],
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
