"use client";

import { CLOCK_CHIP, INSTRUMENT_DIVIDER, TRANSPORT_ROW } from "@/components/ui/control-chrome";
import { IconButton } from "@/components/ui/IconButton";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { cn } from "@/lib/cn";
import { Pause, Play, RotateCcw, StepBack, StepForward } from "lucide-react";
import type { CSSProperties } from "react";
import type { AlgoControls } from "./useAlgoPlayer";

const SPEED_OPTIONS = [0.5, 1, 2, 4].map((s) => ({
  value: s,
  label: `${s}x`,
  ariaLabel: `Speed ${s}x`,
}));

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
  const last = Math.max(total - 1, 0);
  const fill = last === 0 ? 0 : (index / last) * 100;

  return (
    <div className={TRANSPORT_ROW}>
      <IconButton
        // Explicit intent, not `toggle` — same contract as the packet
        // transport. Deriving the action from the `playing` value that
        // renders the label keeps the control honest.
        onClick={() => (playing ? controls.pause() : controls.play())}
        label={playing ? "Pause simulation" : "Play simulation"}
        aria-pressed={playing}
        variant="solid"
      >
        {playing ? (
          <Pause className="size-4" fill="currentColor" strokeWidth={0} />
        ) : (
          <Play className="size-4 translate-x-px" fill="currentColor" strokeWidth={0} />
        )}
      </IconButton>

      <IconButton
        onClick={controls.stepBack}
        disabled={index === 0}
        label="Step back"
        title="Step back"
      >
        <StepBack className="size-4" />
      </IconButton>
      <IconButton
        onClick={controls.stepForward}
        disabled={index >= last}
        label="Step forward"
        title="Step forward"
      >
        <StepForward className="size-4" />
      </IconButton>
      <IconButton
        onClick={controls.restart}
        label="Restart"
        title="Restart"
      >
        <RotateCcw className="size-4" />
      </IconButton>

      <div className={INSTRUMENT_DIVIDER} />

      <SegmentedControl
        ariaLabel="Playback speed"
        size="sm"
        options={SPEED_OPTIONS}
        value={speed}
        onChange={controls.setSpeed}
      />

      <div className="relative order-last flex h-10 w-full items-center sm:order-none sm:mx-3 sm:h-auto sm:w-auto sm:min-w-24 sm:flex-1">
        <input
          type="range"
          min={0}
          max={last}
          value={index}
          onChange={(e) => controls.scrub(Number(e.target.value))}
          aria-label="Scrub through steps"
          aria-valuetext={`step ${index} of ${last}`}
          className="sim-slider h-1 w-full cursor-pointer appearance-none rounded-full bg-border accent-accent"
          style={{ "--fill": `${fill}%` } as CSSProperties}
        />
      </div>

      <span className={cn(CLOCK_CHIP, "ml-auto")}>
        <span
          className={cn(
            "size-1.5 rounded-full transition-all duration-300",
            playing
              ? "animate-pulse bg-glow-green shadow-[0_0_8px_var(--color-glow-green)]"
              : "bg-glow-orange shadow-[0_0_6px_var(--color-glow-orange)]",
          )}
        />
        step {String(index).padStart(3, "0")}/{String(last).padStart(3, "0")}
      </span>
    </div>
  );
}
