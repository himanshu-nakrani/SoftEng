"use client";

import { CornerTicks } from "@/components/ui/CornerTicks";
import { Meter } from "@/components/ui/Meter";
import { Dices } from "lucide-react";
import { useState } from "react";
import { AlgoTransportBar } from "./AlgoTransportBar";
import { ArrayView } from "./ArrayView";
import { CodePanel } from "./CodePanel";
import type { AlgoDef } from "./types";
import { useAlgoPlayer } from "./useAlgoPlayer";

interface AlgoFigureProps {
  def: AlgoDef;
  description: string;
  defaultN?: number;
  /** First meaningful interaction (drives section completion). */
  onEngage?: () => void;
}

/**
 * The AlgoFigure: bar stage + live pseudocode + op counters + a transport
 * that can scrub and step BACKWARD. Composition mirror of InteractiveFigure
 * for the discrete-step world.
 */
export function AlgoFigure({
  def,
  description,
  defaultN = 12,
  onEngage,
}: AlgoFigureProps) {
  const [n, setN] = useState(defaultN);
  const [seed, setSeed] = useState(42);
  const player = useAlgoPlayer(def, n, seed, onEngage);
  const { current } = player;

  return (
    <figure className="my-6 overflow-hidden rounded-lg border border-border bg-surface">
      <div className="relative grid bg-bg/40 lg:grid-cols-[1fr_240px]">
        <div className="relative">
          <CornerTicks />
          <span
            aria-hidden
            className="pointer-events-none absolute top-2.5 right-5 font-mono text-[9px] tracking-[0.12em] text-fg-faint uppercase"
          >
            fig · {def.id} · seed {seed}
          </span>
          <ArrayView step={current} />
          {current.note && (
            <p className="pointer-events-none absolute bottom-2 left-3 flex items-center gap-2 rounded-md border border-border bg-bg/85 px-2.5 py-1.5 font-mono text-[11px] text-fg backdrop-blur-sm">
              <span className="h-3 w-0.5 shrink-0 rounded-full bg-accent" />
              {current.note}
            </p>
          )}
        </div>
        <div className="border-t border-border lg:border-t-0 lg:border-l">
          <p className="tech-label px-3 pt-2.5 pb-1">{def.title}</p>
          <CodePanel code={def.code} activeLine={current.codeLine} />
        </div>
      </div>

      {/* op counters */}
      <div className="grid grid-cols-3 border-t border-border px-4 py-3 sm:flex sm:items-stretch">
        <div className="sm:pr-6">
          <Meter
            spec={{ metricKey: "cmp", label: "comparisons", kind: "counter" }}
            value={current.comparisons}
          />
        </div>
        <div className="px-4 sm:border-l sm:border-border sm:px-6">
          <Meter
            spec={{ metricKey: "swp", label: "swaps / writes", kind: "counter" }}
            value={current.swaps}
          />
        </div>
        <div className="px-4 sm:border-l sm:border-border sm:px-6">
          <Meter
            spec={{ metricKey: "n", label: "n", kind: "counter" }}
            value={n}
          />
        </div>
      </div>

      {/* input controls */}
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3 border-t border-border px-4 py-3">
        <label className="flex min-w-36 flex-col gap-1.5">
          <span className="tech-label flex items-baseline justify-between gap-3">
            array size
            <span className="tech-num text-accent normal-case">{n}</span>
          </span>
          <input
            type="range"
            min={5}
            max={30}
            step={1}
            value={n}
            onChange={(e) => setN(Number(e.target.value))}
            className="h-1 w-full cursor-pointer appearance-none rounded-full bg-border accent-accent"
          />
        </label>
        <button
          onClick={() => setSeed((s) => (s * 48271) % 2147483647)}
          title="New random input (deterministic per seed)"
          className="flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 font-mono text-[11px] text-fg-muted transition-colors hover:border-border-bright hover:text-fg"
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
