"use client";

import { useSectionCompletion } from "@/components/lesson/context";
import { CornerTicks } from "@/components/ui/CornerTicks";
import { cn } from "@/lib/cn";
import { useRef, useState } from "react";

/**
 * C3a — Big-O, felt. One n slider, four growth curves counting actual
 * operations. The ×2 button is the punchline: log gains +1, n doubles,
 * n² quadruples — the same doubling, wildly different bills.
 */

const MAX_N = 512;

interface Curve {
  label: string;
  color: string;
  ops: (n: number) => number;
}

const CURVES: Curve[] = [
  {
    label: "O(log n) — binary search",
    color: "var(--color-glow-green)",
    ops: (n) => Math.max(1, Math.ceil(Math.log2(n))),
  },
  {
    label: "O(n) — linear scan",
    color: "var(--color-glow-cyan)",
    ops: (n) => n,
  },
  {
    label: "O(n log n) — merge sort",
    color: "var(--color-accent)",
    ops: (n) => n * Math.max(1, Math.ceil(Math.log2(n))),
  },
  {
    label: "O(n²) — nested loops",
    color: "var(--color-glow-red)",
    ops: (n) => n * n,
  },
];

const MAX_OPS = CURVES[3].ops(MAX_N);

export function BigORace() {
  const markComplete = useSectionCompletion();
  const [n, setN] = useState(16);
  const prev = useRef<number[]>(CURVES.map((c) => c.ops(16)));
  const [ratios, setRatios] = useState<number[]>([1, 1, 1, 1]);

  const update = (nextN: number) => {
    markComplete();
    const nextOps = CURVES.map((c) => c.ops(nextN));
    setRatios(nextOps.map((ops, i) => ops / Math.max(prev.current[i], 1)));
    prev.current = nextOps;
    setN(nextN);
  };

  return (
    <figure className="relative my-6 overflow-hidden rounded-lg border border-border bg-surface">
      <div className="relative bg-bg/40 p-5">
        <CornerTicks />
        <span
          aria-hidden
          className="pointer-events-none absolute top-2.5 right-5 font-mono text-[9px] tracking-[0.12em] text-fg-faint/80 uppercase"
        >
          fig · big-o-race
        </span>

        <div className="flex flex-col gap-4 pt-2">
          {CURVES.map((curve, i) => {
            const ops = curve.ops(n);
            // log scale so O(n²) doesn't flatten everyone else
            const width =
              (Math.log(ops + 1) / Math.log(MAX_OPS + 1)) * 100;
            return (
              <div key={curve.label}>
                <div className="mb-1 flex items-baseline justify-between gap-4">
                  <span className="font-mono text-[11px] text-fg-muted">
                    {curve.label}
                  </span>
                  <span className="tech-num text-sm font-semibold" style={{ color: curve.color }}>
                    {ops.toLocaleString()}
                    <span className="ml-2 text-[10px] font-normal text-fg-faint">
                      {ratios[i] !== 1 &&
                        `×${ratios[i] >= 10 ? ratios[i].toFixed(0) : ratios[i].toFixed(1)}`}
                    </span>
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-border">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${width}%`,
                      background: curve.color,
                      transition: "width 400ms cubic-bezier(0.22, 1, 0.36, 1)",
                      boxShadow: `0 0 8px ${curve.color}`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <p className="tech-label mt-4">
          bars are log-scaled — on a linear scale, n² would be the only
          visible bar
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-x-6 gap-y-3 border-t border-border px-4 py-3">
        <label className="flex min-w-44 flex-1 flex-col gap-1.5">
          <span className="tech-label flex items-baseline justify-between gap-3">
            n — items to process
            <span className="tech-num text-accent normal-case">{n}</span>
          </span>
          <input
            type="range"
            min={4}
            max={MAX_N}
            step={4}
            value={n}
            onChange={(e) => update(Number(e.target.value))}
            className="h-1 w-full cursor-pointer appearance-none rounded-full bg-border accent-accent"
          />
        </label>
        <button
          onClick={() => update(Math.min(n * 2, MAX_N))}
          disabled={n >= MAX_N}
          className={cn(
            "cursor-pointer rounded-md border border-accent/40 bg-accent-dim px-3 py-1.5",
            "font-mono text-[11px] font-medium text-accent transition-all",
            "hover:brightness-125 active:scale-95 disabled:pointer-events-none disabled:opacity-40",
          )}
        >
          double n
        </button>
        <button
          onClick={() => update(16)}
          className="cursor-pointer rounded-md border border-border px-3 py-1.5 font-mono text-[11px] text-fg-muted transition-colors hover:border-border-bright hover:text-fg"
        >
          reset
        </button>
      </div>
      <figcaption className="sr-only">
        Four operation counters — logarithmic, linear, linearithmic, and
        quadratic — updating live as n changes, with per-curve growth
        multipliers shown when n doubles.
      </figcaption>
    </figure>
  );
}
