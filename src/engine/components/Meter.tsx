"use client";

import { cn } from "@/lib/cn";
import type { MeterSpec } from "../types";

interface MeterProps {
  spec: MeterSpec;
  value: number;
}

function isDanger(spec: MeterSpec, value: number): boolean {
  if (spec.dangerAbove !== undefined && value > spec.dangerAbove) return true;
  if (spec.dangerBelow !== undefined && value < spec.dangerBelow) return true;
  return false;
}

/**
 * One live instrument. Values arrive at 10Hz; CSS transitions interpolate
 * so the display reads continuous.
 */
export function Meter({ spec, value }: MeterProps) {
  const danger = isDanger(spec, value);
  const display = value.toFixed(spec.decimals ?? 0);
  const accent = danger ? "var(--color-glow-red)" : "var(--color-accent)";
  const fraction = spec.max ? Math.min(value / spec.max, 1) : 0;

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="tech-label truncate">{spec.label}</span>

      {spec.kind === "counter" && (
        <span
          className={cn(
            "tech-num text-lg leading-none font-semibold transition-colors",
            danger ? "text-glow-red" : "text-fg",
          )}
        >
          {display}
          {spec.unit && (
            <span className="ml-1 text-[11px] font-normal text-fg-faint">
              {spec.unit}
            </span>
          )}
        </span>
      )}

      {spec.kind === "bar" && (
        <div className="flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full"
              style={{
                width: `${fraction * 100}%`,
                background: accent,
                transition: "width 150ms linear, background 300ms",
              }}
            />
          </div>
          <span
            className={cn(
              "tech-num w-12 text-right text-xs",
              danger ? "text-glow-red" : "text-fg-muted",
            )}
          >
            {display}
            {spec.unit}
          </span>
        </div>
      )}

      {spec.kind === "gauge" && (
        <div className="flex items-center gap-2">
          <svg width={44} height={26} viewBox="0 0 44 26" aria-hidden>
            <path
              d="M 4 24 A 18 18 0 0 1 40 24"
              fill="none"
              stroke="var(--color-border)"
              strokeWidth={4}
              strokeLinecap="round"
            />
            <path
              d="M 4 24 A 18 18 0 0 1 40 24"
              fill="none"
              stroke={accent}
              strokeWidth={4}
              strokeLinecap="round"
              strokeDasharray={Math.PI * 18}
              strokeDashoffset={Math.PI * 18 * (1 - fraction)}
              style={{
                transition:
                  "stroke-dashoffset 150ms linear, stroke 300ms",
              }}
            />
          </svg>
          <span
            className={cn(
              "tech-num text-sm font-semibold",
              danger ? "text-glow-red" : "text-fg",
            )}
          >
            {display}
            {spec.unit && (
              <span className="ml-0.5 text-[10px] font-normal text-fg-faint">
                {spec.unit}
              </span>
            )}
          </span>
        </div>
      )}
    </div>
  );
}
