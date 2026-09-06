"use client";

import { IconButton } from "@/components/ui/IconButton";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
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
    <div className="flex flex-wrap items-center gap-1 border-t border-border px-3 py-2">
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

      <div className="mx-2 h-4 w-px bg-border" />

      <SegmentedControl
        ariaLabel="Playback speed"
        size="sm"
        options={SPEED_OPTIONS}
        value={speed}
        onChange={controls.setSpeed}
      />

      {/* scrubber — drag through the whole run */}
      <input
        type="range"
        min={0}
        max={last}
        value={index}
        onChange={(e) => controls.scrub(Number(e.target.value))}
        aria-label="Scrub through steps"
        className="sim-slider mx-3 h-1 min-w-24 flex-1 cursor-pointer appearance-none rounded-full bg-border accent-accent"
        style={{ "--fill": `${fill}%` } as CSSProperties}
      />

      <span className="tech-num text-xs text-fg-muted">
        step {String(index).padStart(3, "0")}/{String(last).padStart(3, "0")}
      </span>
    </div>
  );
}
