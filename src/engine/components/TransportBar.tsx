"use client";

import { cn } from "@/lib/cn";
import { Pause, Play, RotateCcw, StepForward } from "lucide-react";
import type { SimControls, SimStatus } from "../useSimulation";

const SPEEDS = [0.5, 1, 2];

interface TransportBarProps {
  status: SimStatus;
  speed: number;
  t: number;
  controls: SimControls;
}

/** Play / pause / step / speed / restart + the sim clock. */
export function TransportBar({ status, speed, t, controls }: TransportBarProps) {
  const playing = status === "playing";

  return (
    <div className="flex items-center gap-1 border-t border-border px-3 py-2">
      <button
        onClick={controls.toggle}
        disabled={status === "quiz"}
        aria-label={playing ? "Pause simulation" : "Play simulation"}
        className="flex size-8 cursor-pointer items-center justify-center rounded-lg bg-accent text-bg transition-all hover:brightness-110 disabled:opacity-40"
      >
        {playing ? (
          <Pause className="size-4" fill="currentColor" strokeWidth={0} />
        ) : (
          <Play className="size-4 translate-x-px" fill="currentColor" strokeWidth={0} />
        )}
      </button>

      <button
        onClick={controls.stepOnce}
        disabled={playing || status === "quiz"}
        aria-label="Advance one tick"
        title="Step one tick"
        className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-raised hover:text-fg disabled:pointer-events-none disabled:opacity-40"
      >
        <StepForward className="size-4" />
      </button>

      <button
        onClick={controls.restart}
        aria-label="Restart simulation"
        title="Restart (deterministic replay)"
        className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-raised hover:text-fg"
      >
        <RotateCcw className="size-4" />
      </button>

      <div className="mx-2 h-4 w-px bg-border" />

      <div className="flex overflow-hidden rounded-md border border-border">
        {SPEEDS.map((s) => (
          <button
            key={s}
            onClick={() => controls.setSpeed(s)}
            aria-label={`Speed ${s}x`}
            className={cn(
              "cursor-pointer px-2 py-0.5 font-mono text-[10px] transition-colors",
              speed === s
                ? "bg-accent-dim text-accent"
                : "text-fg-faint hover:text-fg-muted",
            )}
          >
            {s}x
          </button>
        ))}
      </div>

      <span className="tech-num ml-auto flex items-center gap-2 text-xs text-fg-muted">
        <span
          className={cn(
            "size-1.5 rounded-full",
            playing
              ? "animate-pulse bg-glow-green shadow-[0_0_6px_var(--color-glow-green)]"
              : status === "quiz"
                ? "bg-glow-violet"
                : "bg-glow-orange",
          )}
        />
        t={t.toFixed(1)}s
      </span>
    </div>
  );
}
