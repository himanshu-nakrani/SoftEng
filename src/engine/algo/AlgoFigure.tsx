"use client";

import { CornerTicks } from "@/components/ui/CornerTicks";
import { Meter } from "@/components/ui/Meter";
import { PlateLabel } from "@/components/ui/PlateLabel";
import { Dices } from "lucide-react";
import type { ComponentType, CSSProperties } from "react";
import { useState } from "react";
import { AlgoTransportBar } from "./AlgoTransportBar";
import { CodePanel } from "./CodePanel";
import { defaultAlgoSize } from "./build";
import type { AlgoDef } from "./types";
import { useAlgoPlayer } from "./useAlgoPlayer";

interface AlgoFigureProps<S, I> {
  def: AlgoDef<S, I>;
  /**
   * How to draw one frame. The seam that makes this engine reusable: swap the
   * view and the same transport, code panel, counters, and seeding work for a
   * B-tree, a run queue, or a WAL replay.
   */
  view: ComponentType<{ state: S }>;
  description: string;
  /** Overrides `def.size.default`. */
  defaultSize?: number;
  /** First meaningful interaction (drives section completion). */
  onEngage?: () => void;
}

/**
 * The AlgoFigure: a view stage + live pseudocode + counters + a transport that
 * can scrub and step BACKWARD. Composition mirror of `InteractiveFigure` for
 * the discrete-step world.
 *
 * Everything variable comes from the def, so adding an algorithm never edits
 * this file: counters are declared (`def.counters`), the size control is
 * declared (`def.size`, omitted for fixed-input algorithms), and the stage is
 * injected (`view`).
 */
export function AlgoFigure<S, I>({
  def,
  view: View,
  description,
  defaultSize,
  onEngage,
}: AlgoFigureProps<S, I>) {
  const [size, setSize] = useState(() => defaultAlgoSize(def, defaultSize));
  const [seed, setSeed] = useState(42);
  const player = useAlgoPlayer(def, size, seed, onEngage);
  const { current } = player;

  return (
    <figure className="my-6 overflow-hidden rounded-lg border border-border bg-surface">
      <div className="relative grid bg-bg/40 lg:grid-cols-[1fr_240px]">
        <div className="relative flex flex-col">
          <CornerTicks />
          <PlateLabel className="absolute top-2.5 right-5">
            fig · {def.id} · seed {seed}
          </PlateLabel>
          <View state={current.state} />
          {/*
            The caption sits BELOW the stage, not over it. It used to be
            absolutely positioned at the bottom-left, which works only while the
            stage has dead space down there — a view with content near its floor
            (the threads lanes, the mutation grid) had its last row covered. It
            cannot be solved by padding the viewBox either: the caption is fixed
            px while the SVG scales with the container, so the overlap comes and
            goes with viewport width. `min-h` keeps the layout still on steps
            that carry no note.
          */}
          <div className="mt-auto flex min-h-9 items-center px-3 pb-2">
            {current.note && (
              <p className="flex items-center gap-2 rounded-md border border-border bg-bg/85 px-2.5 py-1.5 font-mono text-[11px] text-fg">
                <span className="h-3 w-0.5 shrink-0 rounded-full bg-accent" />
                {current.note}
              </p>
            )}
          </div>
        </div>
        <div className="border-t border-border lg:border-t-0 lg:border-l">
          <p className="tech-label px-3 pt-2.5 pb-1">{def.title}</p>
          <CodePanel code={def.code} activeLine={current.codeLine} />
        </div>
      </div>

      {/* counters — declared by the def, so a new algorithm adds its own
          (splits, disk reads, retries) without touching the figure */}
      {def.counters.length > 0 && (
        <div className="flex flex-wrap items-stretch gap-2.5 border-t border-border px-4 py-3">
          {def.counters.map((counter) => (
            <div
              key={counter.key}
              className="flex-1 min-w-[120px] rounded-lg border border-border/50 bg-surface/40 p-2.5 transition-all duration-200 hover:border-border"
            >
              <Meter
                spec={{
                  metricKey: counter.key,
                  label: counter.label,
                  kind: "counter",
                }}
                value={current.counters[counter.key] ?? 0}
              />
            </div>
          ))}
        </div>
      )}
      {/* The size is deliberately NOT reported here. It is an INPUT, not a
          running total, and its own slider already prints the same label beside
          the same value — rendering both put "operations before the crash 4"
          on the screen twice, three lines apart. Invisible until the first
          lesson def with a `size` was actually rendered. */}

      {/* input controls */}
      <div className="flex flex-wrap items-end gap-x-6 gap-y-4 border-t border-border px-4 py-3">
        {def.size && (
          <label className="flex flex-1 min-w-[160px] max-w-sm flex-col gap-1.5">
            <span className="tech-label flex items-baseline justify-between gap-3">
              <span className="truncate">{def.size.label}</span>
              <span className="tech-num shrink-0 font-mono text-xs font-semibold text-accent normal-case">{size}</span>
            </span>
            <input
              type="range"
              min={def.size.min}
              max={def.size.max}
              step={1}
              value={size}
              onChange={(e) => setSize(Number(e.target.value))}
              className="sim-slider h-1 w-full cursor-pointer appearance-none rounded-full bg-border accent-accent"
              style={
                {
                  "--fill": `${((size - def.size.min) / Math.max(def.size.max - def.size.min, 1)) * 100}%`,
                } as CSSProperties
              }
            />
          </label>
        )}
        <button
          onClick={() => setSeed((s) => (s * 48271) % 2147483647)}
          title="New random input (deterministic per seed)"
          className="flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-border bg-surface/60 px-3 py-1.5 font-mono text-[11px] text-fg-muted transition-colors hover:border-border-bright hover:text-fg active:scale-95"
        >
          <Dices className="size-3.5" />
          shuffle · seed {seed}
        </button>
      </div>

      <AlgoTransportBar
        playing={player.playing}
        speed={player.speed}
        index={player.index}
        total={player.steps.length}
        controls={player.controls}
      />
      <figcaption className="sr-only">{description}</figcaption>
    </figure>
  );
}
