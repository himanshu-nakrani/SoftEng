"use client";

import { SectionFigure } from "@/components/lesson/SectionFigure";
import type { SimSnapshot } from "@/engine/snapshot";
import { cacheStampedeSim } from "./cache-stampede";

/* Node-local geometry, in the 88x60 box SystemNode draws in. The bar hangs
   ABOVE the box (negative y) — the free band inside is where the label lives,
   and the load bar already owns y 48..51. */
const BAR_X = 12;
const BAR_Y = -9;
const BAR_W = 64;
const BAR_H = 4;

function metaNumber(
  meta: Record<string, unknown> | undefined,
  key: string,
  fallback: number,
): number {
  const value = meta?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/**
 * The hot key's TTL, drawn as the thing it is: a countdown. It drains left to
 * right, goes amber→orange in its last quarter, and empties the instant the key
 * expires — which is the exact frame everything else in the figure reacts to.
 * Violet while a stale copy is being served (SWR), matching the stale packets.
 */
function TtlBar({ runtime }: { runtime: SimSnapshot["nodes"][string] }) {
  const ttl = metaNumber(runtime.meta, "ttl", 1);
  const left = metaNumber(runtime.meta, "ttlLeft", 0);
  const stale = runtime.meta?.servingStale === true;
  const frac = ttl > 0 ? Math.max(0, Math.min(1, left / ttl)) : 0;
  const color = stale
    ? "var(--color-glow-violet)"
    : frac <= 0.25
      ? "var(--color-glow-orange)"
      : "var(--color-accent)";

  return (
    <g aria-hidden>
      <rect
        x={BAR_X}
        y={BAR_Y}
        width={BAR_W}
        height={BAR_H}
        rx={2}
        fill="var(--color-border)"
      />
      <rect
        x={BAR_X}
        y={BAR_Y}
        width={BAR_W}
        height={BAR_H}
        rx={2}
        fill={color}
        style={{
          transformBox: "fill-box",
          transformOrigin: "left",
          transform: `scaleX(${stale ? 1 : frac})`,
          transition: "transform 150ms linear, fill 300ms",
        }}
      />
    </g>
  );
}

export function CacheStampedeFigure() {
  return (
    <SectionFigure
      sim={cacheStampedeSim}
      nodeOverlay={(spec, runtime) =>
        spec.id === "cache" ? <TtlBar runtime={runtime} /> : null
      }
      // The coalescing switch is the subject of the last section, and the
      // prediction is what proves it — either one completes that section from
      // this figure, which lives one section up.
      completes={[
        { on: "param-change", id: "coalesce", section: "coalesce" },
        { on: "quiz-answered", id: "stampede-coalesce", section: "coalesce" },
      ]}
      description="Clients reading one hot key through redis-1, backed by pg-main, which serves five reads a second. The bar above redis-1 counts down the hot key's TTL; green packets are hits, cyan are reads travelling on to pg-main, violet are stale answers served while a refresh runs. When the key expires, every reader that misses it fetches from pg-main — the fetches / expiry meter counts them, and pg-main's queue chip and load bar climb until it degrades and then refuses new reads outright. Turning coalescing on parks those readers at redis-1 instead (the count chip on the node) and sends exactly one fetch; stale-while-revalidate hands out the expired copy so nobody waits at all. Sliders set the TTL and the traffic rate, and the expire hot key button drops the key on demand."
    />
  );
}
