"use client";

import { cn } from "@/lib/cn";
import { Zap } from "lucide-react";
import type { ParamSpec, ParamValue, ParamValues } from "../types";

interface ControlPanelProps {
  specs: ParamSpec[];
  values: ParamValues;
  onChange: (key: string, value: ParamValue) => void;
  onPress: (key: string) => void;
}

/** Live parameter controls — changes take effect next tick, no restart. */
export function ControlPanel({
  specs,
  values,
  onChange,
  onPress,
}: ControlPanelProps) {
  if (specs.length === 0) return null;

  return (
    <div className="flex flex-wrap items-end gap-x-6 gap-y-3 border-t border-border px-4 py-3">
      {specs.map((spec) => {
        const value = values[spec.key];

        if (spec.kind === "slider") {
          return (
            <label key={spec.key} className="flex min-w-36 flex-col gap-1.5">
              <span className="tech-label flex items-baseline justify-between gap-3">
                {spec.label}
                <span className="tech-num text-accent normal-case">
                  {value}
                  {spec.unit}
                </span>
              </span>
              <input
                type="range"
                min={spec.min}
                max={spec.max}
                step={spec.step}
                value={Number(value)}
                onChange={(e) => onChange(spec.key, Number(e.target.value))}
                className="h-1 w-full cursor-pointer appearance-none rounded-full bg-border accent-accent"
              />
            </label>
          );
        }

        if (spec.kind === "toggle") {
          const on = Boolean(value);
          return (
            <button
              key={spec.key}
              role="switch"
              aria-checked={on}
              onClick={() => onChange(spec.key, !on)}
              className="flex cursor-pointer items-center gap-2"
            >
              <span className="tech-label">{spec.label}</span>
              <span
                className={cn(
                  "relative h-4.5 w-8 rounded-full transition-colors",
                  on ? "bg-accent" : "bg-border",
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 left-0.5 size-3.5 rounded-full bg-fg transition-transform",
                    on && "translate-x-3.5 bg-bg",
                  )}
                />
              </span>
            </button>
          );
        }

        if (spec.kind === "select") {
          return (
            <div key={spec.key} className="flex flex-col gap-1.5">
              <span className="tech-label">{spec.label}</span>
              <div
                role="radiogroup"
                aria-label={spec.label}
                className="flex overflow-hidden rounded-lg border border-border"
              >
                {spec.options?.map((opt) => {
                  const selected = value === opt.value;
                  return (
                    <button
                      key={opt.value}
                      role="radio"
                      aria-checked={selected}
                      onClick={() => onChange(spec.key, opt.value)}
                      className={cn(
                        "cursor-pointer px-2.5 py-1 font-mono text-[11px] transition-colors",
                        selected
                          ? "bg-accent-dim text-accent"
                          : "text-fg-muted hover:bg-raised hover:text-fg",
                      )}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        }

        // kind === "button" — momentary scenario trigger
        return (
          <button
            key={spec.key}
            onClick={() => onPress(spec.key)}
            className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-glow-amber/40 bg-glow-amber-dim px-3 py-1.5 font-mono text-[11px] font-medium text-glow-amber transition-all hover:brightness-125 active:scale-95"
          >
            <Zap className="size-3" />
            {spec.label}
          </button>
        );
      })}
    </div>
  );
}
