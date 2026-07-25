"use client";

import { SectionFigure } from "@/components/lesson/SectionFigure";
import type { SimSnapshot } from "@/engine/snapshot";
import type { NodeSpec } from "@/engine/types";
import type { ReactNode } from "react";
import { deliveryGuaranteesSim, type DedupMeta } from "./delivery-guarantees";

/** SystemNode's box width — the badge centers on it. */
const NODE_W = 88;
/** Sim-seconds the "DEDUPED" flash stays lit after a duplicate is absorbed. */
const FLASH_SECS = 1.1;

type NodeRuntimeView = SimSnapshot["nodes"][string];

function readMeta(runtime: NodeRuntimeView): DedupMeta | null {
  const meta = runtime.meta;
  if (!meta || typeof meta.keys !== "number") return null;
  return {
    on: meta.on === true,
    keys: meta.keys,
    lastHit: typeof meta.lastHit === "number" ? meta.lastHit : -1,
  };
}

/**
 * payments-db's dedup window, hung above the box.
 *
 * Three states, because the lesson has three outcomes: `no dedup` (the db
 * will happily charge the same card twice), `keys N` (it is remembering), and
 * a green `DEDUPED` flash on the tick a duplicate arrives and costs nothing.
 * The flash is derived from `snapshot.t - lastHit` rather than a timer, so it
 * obeys pause, step and speed exactly like everything else on the stage.
 */
function dedupBadge(
  spec: NodeSpec,
  runtime: NodeRuntimeView,
  snapshot: SimSnapshot,
): ReactNode {
  if (spec.id !== "db") return null;
  const meta = readMeta(runtime);
  if (!meta) return null;

  const flashing =
    meta.on && meta.lastHit >= 0 && snapshot.t - meta.lastHit < FLASH_SECS;
  const text = flashing ? "DEDUPED" : meta.on ? `keys ${meta.keys}` : "no dedup";
  const color = flashing
    ? "var(--color-glow-green)"
    : meta.on
      ? "var(--color-accent)"
      : "var(--color-fg-faint)";
  const border = flashing
    ? "var(--color-glow-green)"
    : meta.on
      ? "var(--color-accent)"
      : "var(--color-border-bright)";
  const w = text.length * 5.6 + 14;

  // -13 clears SystemNode's own chrome (the dead-cross badge starts at y=-5).
  return (
    <g transform={`translate(${NODE_W / 2} -13)`}>
      <rect
        x={-w / 2}
        y={-7}
        width={w}
        height={14}
        rx={7}
        fill="var(--color-raised)"
        stroke={border}
        strokeWidth={flashing ? 1.25 : 0.75}
        style={{ transition: "stroke 200ms" }}
      />
      <text
        y={3.5}
        textAnchor="middle"
        fill={color}
        style={{
          font: "600 9px var(--font-plex-mono)",
          letterSpacing: "0.04em",
        }}
      >
        {text}
      </text>
    </g>
  );
}

export function DeliveryGuaranteesFigure() {
  return (
    <SectionFigure
      sim={deliveryGuaranteesSim}
      nodeOverlay={dedupBadge}
      // "idempotency" has no figure of its own — flipping the dedup toggle
      // (or predicting what redelivery does) is the whole of that section.
      completes={[
        { on: "param-change", id: "dedup", section: "idempotency" },
        { on: "quiz-answered", id: "dg-redelivery", section: "idempotency" },
      ]}
      description="A payments pipeline: checkout publishes messages into payments-q, worker-1 takes one at a time, charges payments-db, and acks. The ack is drawn as a small cyan dot flying back to the queue — under at-least-once it leaves after the charge is confirmed, under at-most-once it leaves the instant the message is taken. worker-1 can be crashed with the button or by clicking it, and restarts about 1.5 seconds later. A crash before the ack sends the message back to the queue, and the orange redelivery charges the card a second time unless the idempotency-keys toggle is on, in which case payments-db recognises the key and the badge above it flashes DEDUPED. Meters show processed messages, queue depth, double charges, lost payments and absorbed duplicates."
    />
  );
}
