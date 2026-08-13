"use client";

import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { cn } from "@/lib/cn";
import { Zap } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { ParamSpec, ParamValue, ParamValues } from "../types";

interface ControlPanelProps {
  specs: ParamSpec[];
  values: ParamValues;
  onChange: (key: string, value: ParamValue) => void;
  onPress: (key: string) => void;
}

/** How long a pressed scenario button stays visibly "fired" (ms). */
const FIRED_MS = 600;

/**
 * A momentary "button" param — a scenario trigger ("kill a shard", "burst").
 *
 * The press is consumed by the lesson's next `step`, which for a paused sim
 * could be seconds away (the hook resumes play on press, see
 * `useSimulation.pressButton`) — so the control also confirms *itself*: a
 * brief lit state for sighted users and a live-region line for screen readers.
 * Own component because the flash is per-button local state and hooks cannot
 * live inside the `specs.map` below.
 */
function ButtonParam({
  spec,
  onPress,
}: {
  spec: ParamSpec;
  onPress: (key: string) => void;
}) {
  const [fired, setFired] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduced = useReducedMotion();

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const press = () => {
    onPress(spec.key);
    if (timer.current) clearTimeout(timer.current);
    // Off first, so a second press re-announces (an unchanged live region is
    // silent) and re-runs the flash.
    setFired(false);
    timer.current = setTimeout(() => {
      setFired(true);
      timer.current = setTimeout(() => setFired(false), FIRED_MS);
    }, 0);
  };

  return (
    // Two siblings, no wrapper: the button stays a direct flex child of the
    // panel and the status line is sr-only (absolutely positioned), so neither
    // changes the row's layout.
    <>
      <button
        type="button"
        onClick={press}
        className={cn(
          "flex min-h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-glow-amber/40 bg-glow-amber-dim px-3 py-1.5 font-mono text-[11px] font-medium text-glow-amber transition-all hover:brightness-125 active:scale-95",
          // Reduced motion keeps the state change (information) and drops the
          // pulsing (decoration).
          fired && "ring-2 ring-glow-amber/70 brightness-150",
          fired && !reduced && "animate-pulse",
        )}
      >
        <Zap className="size-3" />
        {spec.label}
      </button>
      <span role="status" className="sr-only">
        {fired ? `${spec.label} triggered` : ""}
      </span>
    </>
  );
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
                // Without this a screen reader reads the raw number ("40");
                // the unit is what makes it a rate, a percentage, a count.
                aria-valuetext={`${value}${spec.unit ?? ""}`}
                onChange={(e) => onChange(spec.key, Number(e.target.value))}
                className="sim-slider h-1 w-full cursor-pointer appearance-none rounded-full bg-border accent-accent"
                // Drives the filled-track gradient in globals.css.
                style={
                  {
                    "--fill": `${((Number(value) - (spec.min ?? 0)) / ((spec.max ?? 100) - (spec.min ?? 0))) * 100}%`,
                  } as React.CSSProperties
                }
              />
            </label>
          );
        }

        if (spec.kind === "toggle") {
          const on = Boolean(value);
          return (
            <button
              key={spec.key}
              type="button"
              role="switch"
              aria-checked={on}
              onClick={() => onChange(spec.key, !on)}
              className="flex min-h-8 cursor-pointer items-center gap-2"
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
              <SegmentedControl
                ariaLabel={spec.label}
                options={(spec.options ?? []).map((opt) => ({
                  value: opt.value,
                  label: opt.label,
                }))}
                value={value === undefined ? undefined : String(value)}
                onChange={(next) => onChange(spec.key, next)}
              />
            </div>
          );
        }

        // kind === "button" — momentary scenario trigger
        return <ButtonParam key={spec.key} spec={spec} onPress={onPress} />;
      })}
    </div>
  );
}
