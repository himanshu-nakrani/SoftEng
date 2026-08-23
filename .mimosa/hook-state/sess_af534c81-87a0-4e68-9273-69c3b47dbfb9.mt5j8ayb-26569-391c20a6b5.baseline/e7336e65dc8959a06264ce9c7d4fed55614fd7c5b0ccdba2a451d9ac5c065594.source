"use client";

import { useSectionCompletion } from "@/components/lesson/context";
import { CornerTicks } from "@/components/ui/CornerTicks";
import { Meter } from "@/components/ui/Meter";
import { PlateLabel } from "@/components/ui/PlateLabel";
import { mulberry32 } from "@/engine/rng";
import { cn } from "@/lib/cn";
import { Plus, RotateCcw, Scaling } from "lucide-react";
import { useRef, useState } from "react";

/**
 * C3d — Hash Table Lab. Keys hash into buckets; collisions chain; load
 * factor climbs; RESIZE ×2 rehashes everything — sharding's remap
 * problem, rediscovered at data-structure scale.
 */

function hashKey(key: number, buckets: number): number {
  let h = key >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) % buckets;
}

export function HashTableLab() {
  const markComplete = useSectionCompletion();
  const [bucketCount, setBucketCount] = useState(8);
  const [keys, setKeys] = useState<number[]>([]);
  const [resizeCount, setResizeCount] = useState(0);
  const rng = useRef(mulberry32(97));

  const insert = (count: number) => {
    markComplete();
    const fresh = Array.from({ length: count }, () =>
      Math.floor(rng.current() * 900) + 100,
    );
    setKeys((k) => [...k, ...fresh]);
  };

  const resize = () => {
    markComplete();
    setBucketCount((b) => Math.min(b * 2, 32));
    setResizeCount((c) => c + 1);
  };

  const reset = () => {
    setKeys([]);
    setBucketCount(8);
    setResizeCount(0);
    rng.current = mulberry32(97);
  };

  const buckets: number[][] = Array.from({ length: bucketCount }, () => []);
  for (const key of keys) buckets[hashKey(key, bucketCount)].push(key);
  const longest = Math.max(0, ...buckets.map((b) => b.length));
  const loadFactor = keys.length / bucketCount;

  return (
    <figure className="my-6 overflow-hidden rounded-lg border border-border bg-surface">
      <div className="relative bg-bg/40 p-5">
        <CornerTicks />
        <PlateLabel className="absolute top-2.5 right-5">
          fig · hash-table · {bucketCount} buckets
        </PlateLabel>

        <div
          className="grid gap-1.5 pt-3"
          style={{
            gridTemplateColumns: `repeat(${bucketCount}, minmax(0, 1fr))`,
          }}
        >
          {buckets.map((bucket, i) => (
            <div key={`${bucketCount}:${i}`} className="min-w-0">
              <div
                className={cn(
                  "flex min-h-36 flex-col-reverse items-stretch gap-1 rounded-md border border-border bg-surface/60 p-1",
                  bucket.length === longest &&
                    longest > 3 &&
                    "border-glow-red/60 shadow-[0_0_16px_-6px_var(--color-glow-red)]",
                )}
              >
                {bucket.map((key, j) => (
                  <span
                    key={`${key}-${j}`}
                    className={cn(
                      "truncate rounded-sm px-1 py-0.5 text-center font-mono text-[9px]",
                      j === 0
                        ? "bg-accent-dim text-accent"
                        : "bg-raised text-fg-muted",
                    )}
                    title={j > 0 ? "chained — extra hop on lookup" : undefined}
                  >
                    {key}
                  </span>
                ))}
              </div>
              <p className="tech-num mt-1 text-center text-[9px] text-fg-faint">
                {i}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 border-t border-border px-4 py-3 sm:flex sm:items-stretch">
        <div className="sm:pr-6">
          <Meter
            spec={{ metricKey: "items", label: "keys stored", kind: "counter" }}
            value={keys.length}
          />
        </div>
        <div className="px-4 sm:border-l sm:border-border sm:px-6">
          <Meter
            spec={{
              metricKey: "lf",
              label: "load factor",
              kind: "gauge",
              max: 3,
              decimals: 2,
              dangerAbove: 0.75,
            }}
            value={loadFactor}
          />
        </div>
        <div className="px-4 sm:border-l sm:border-border sm:px-6">
          <Meter
            spec={{
              metricKey: "chain",
              label: "longest chain",
              kind: "counter",
              dangerAbove: 3,
            }}
            value={longest}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-3">
        <button
          onClick={() => insert(1)}
          className="flex cursor-pointer items-center gap-1.5 rounded-md border border-accent/40 bg-accent-dim px-3 py-1.5 font-mono text-[11px] font-medium text-accent transition-all hover:brightness-125 active:scale-95"
        >
          <Plus className="size-3" />
          insert key
        </button>
        <button
          onClick={() => insert(10)}
          className="flex cursor-pointer items-center gap-1.5 rounded-md border border-accent/40 bg-accent-dim px-3 py-1.5 font-mono text-[11px] font-medium text-accent transition-all hover:brightness-125 active:scale-95"
        >
          <Plus className="size-3" />
          insert ×10
        </button>
        <button
          onClick={resize}
          disabled={bucketCount >= 32}
          className="flex cursor-pointer items-center gap-1.5 rounded-md border border-glow-violet/40 bg-glow-violet-dim px-3 py-1.5 font-mono text-[11px] font-medium text-glow-violet transition-all hover:brightness-125 active:scale-95 disabled:pointer-events-none disabled:opacity-40"
        >
          <Scaling className="size-3" />
          resize ×2 — rehash all
        </button>
        <button
          onClick={reset}
          className="ml-auto flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-3 py-1.5 font-mono text-[11px] text-fg-muted transition-colors hover:border-border-bright hover:text-fg"
        >
          <RotateCcw className="size-3" />
          reset
        </button>
        {resizeCount > 0 && (
          <span className="tech-label w-full">
            every key re-homed on resize — hash(key) % {bucketCount} is a
            different question than % {bucketCount / 2} (sharding lesson,
            anyone?)
          </span>
        )}
      </div>
      <figcaption className="sr-only">
        A hash table with visible buckets. Inserted keys hash into columns;
        colliding keys chain vertically and the longest chain highlights
        red. Meters show key count, load factor, and longest chain. A
        resize button doubles the buckets and rehashes every key.
      </figcaption>
    </figure>
  );
}
