"use client";

import { cn } from "@/lib/cn";
import {
  Pause,
  Play,
  RotateCcw,
  StepBack,
  StepForward,
} from "lucide-react";
import type { AlgoControls } from "./useAlgoPlayer";

const SPEEDS = [0.5, 1, 2, 4];

interface AlgoTransportBarProps {
  playing: boolean;
  speed: number;
  index: number;
  total: number;
  controls: AlgoControls;
}

/** Transport with the algo engine's superpowers: step-back and scrubbing. */
export function AlgoTransportBar({
  playing,
  speed,
  index,
  total,
  controls,
}: AlgoTransportBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-1 border-t border-border px-3 py-2">
      <button
        onClick={controls.toggle}
        // Deliberately the SAME accessible names as the packet engine's
        // TransportBar. A screen-reader user must not get "Play" on one figure
        // and "Play simulation" on the next, and the e2e helpers locate the
        // transport by these names across both archetypes.
        aria-label={playing ? "Pause simulation" : "Play simulation"}
        className="flex size-8 cursor-pointer items-center justify-center rounded-lg bg-accent text-bg transition-all hover:brightness-110"
      >
        {playing ? (
          <Pause className="size-4" fill="currentColor" strokeWidth={0} />
        ) : (
          <Play className="size-4 translate-x-px" fill="currentColor" strokeWidth={0} />
        )}
      </button>

      <button
        onClick={controls.stepBack}
        disabled={index === 0}
        aria-label="Step back"
        title="Step back"
        className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-raised hover:text-fg disabled:pointer-events-none disabled:opacity-40"
      >
        <StepBack className="size-4" />
      </button>
      <button
        onClick={controls.stepForward}
        disabled={index >= total - 1}
        aria-label="Step forward"
        title="Step forward"
        className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-raised hover:text-fg disabled:pointer-events-none disabled:opacity-40"
      >
        <StepForward className="size-4" />
      </button>
      <button
        onClick={controls.restart}
        aria-label="Restart"
        title="Restart"
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

      {/* scrubber — drag through the whole run */}
      <input
        type="range"
        min={0}
        max={Math.max(total - 1, 0)}
        value={index}
        onChange={(e) => controls.scrub(Number(e.target.value))}
        aria-label="Scrub through steps"
        className="mx-3 h-1 min-w-24 flex-1 cursor-pointer appearance-none rounded-full bg-border accent-accent"
      />

      <span className="tech-num text-xs text-fg-muted">
        step {String(index).padStart(3, "0")}/{String(total - 1).padStart(3, "0")}
      </span>
    </div>
  );
}
