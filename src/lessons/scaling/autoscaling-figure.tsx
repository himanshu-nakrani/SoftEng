"use client";

import { SectionFigure } from "@/components/lesson/SectionFigure";
import type { SimSnapshot } from "@/engine/snapshot";
import { autoscalingSim } from "./autoscaling";

/* Node geometry, mirroring SystemNode's 88x60 box centered on the spec coords.
   These decorations are drawn through `stageOverlay` rather than `nodeOverlay`
   because a booting box is still a GHOST, and SystemNode deliberately draws no
   internals inside a ghost — so the countdown has to live on the stage layer,
   underneath the dashed outline (which has no fill, so it all shows through). */
const W = 88;
const H = 60;
const BAR_W = 60;

function metaNumber(
  meta: Record<string, unknown> | undefined,
  key: string,
): number | null {
  const value = meta?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * What a ghost is doing. Two states worth drawing:
 *
 * - BOOTING — an amber ring around the dashed outline, a progress bar where
 *   the load bar will be once it is real, and a countdown to the right. The
 *   box takes no traffic for the whole of it: that wait is the lesson.
 * - DRAINING — a faint ring and a label, for the box the autoscaler has taken
 *   out of rotation and is about to hand back.
 */
function ProvisioningOverlay(snapshot: SimSnapshot) {
  return (
    <g aria-hidden>
      {autoscalingSim.topology.nodes.map((spec) => {
        const runtime = snapshot.nodes[spec.id];
        if (!runtime) return null;
        const remaining = metaNumber(runtime.meta, "bootRemaining");
        const total = metaNumber(runtime.meta, "bootTotal");
        const draining = runtime.meta?.draining === true;
        if (remaining === null || total === null || total <= 0) {
          if (!draining) return null;
          return (
            <g key={spec.id}>
              <rect
                x={spec.x - W / 2 - 4}
                y={spec.y - H / 2 - 4}
                width={W + 8}
                height={H + 8}
                rx={13}
                fill="none"
                stroke="var(--color-fg-faint)"
                strokeWidth={1}
                strokeDasharray="3 5"
              />
              <text
                x={spec.x + W / 2 + 8}
                y={spec.y + 3.5}
                fill="var(--color-fg-faint)"
                style={{ font: "500 9px var(--font-plex-mono)" }}
              >
                draining
              </text>
            </g>
          );
        }
        const progress = Math.max(0, Math.min(1, 1 - remaining / total));
        return (
          <g key={spec.id}>
            <rect
              x={spec.x - W / 2}
              y={spec.y - H / 2}
              width={W}
              height={H}
              rx={10}
              fill="var(--color-accent-dim)"
              stroke="var(--color-accent)"
              strokeWidth={1}
              strokeDasharray="5 4"
              opacity={0.65}
            />
            <rect
              x={spec.x - BAR_W / 2}
              y={spec.y + 16}
              width={BAR_W}
              height={3}
              rx={1.5}
              fill="var(--color-border)"
            />
            <rect
              x={spec.x - BAR_W / 2}
              y={spec.y + 16}
              width={BAR_W * progress}
              height={3}
              rx={1.5}
              fill="var(--color-accent)"
              style={{ transition: "width 150ms linear" }}
            />
            <text
              x={spec.x + W / 2 + 8}
              y={spec.y + 3.5}
              fill="var(--color-accent)"
              style={{ font: "600 9px var(--font-plex-mono)" }}
            >
              boot {remaining.toFixed(1)}s
            </text>
          </g>
        );
      })}
    </g>
  );
}

export function AutoscalingFigure(props: { seed?: number }) {
  return (
    <SectionFigure
      sim={autoscalingSim}
      seed={props.seed}
      stageOverlay={ProvisioningOverlay}
      // "the-cliff" has no figure of its own. Its subject is the gap between
      // ordering capacity and having it, so it completes on the checkpoint
      // that asks about the gap and on stretching the lag that causes it —
      // not on the cooldown slider, which belongs to the flapping story.
      completes={[
        { on: "quiz-answered", id: "as-gap", section: "the-cliff" },
        { on: "param-change", id: "lag", section: "the-cliff" },
      ]}
      description="A load balancer spreading traffic across a fleet of six servers, of which only two are running at the start — the other four are drawn as faint dashed outlines, unprovisioned capacity that receives no traffic. An autoscaler watches the average of the servers' load bars: when it stays above the scale-out threshold it provisions a dashed server, which then shows an amber boot countdown and progress bar and still takes no traffic until the countdown finishes, at which point it turns solid and joins the rotation. When average load stays below the scale-in threshold for a cooldown, the newest server drains and returns to a dashed outline. Sliders set the scale-out threshold, the scale-in threshold, the provisioning lag in seconds, and the cooldown; servers can be clicked to kill or revive them. Meters show average load, live capacity in requests per second, how many servers are booting, a sparkline of total queued requests, and dropped requests. Traffic ramps gently early on — the new server boots and lands before the load needs it — and then steps up almost threefold at once, so the queues fill and requests are dropped throughout the boot time the fleet has to wait out."
    />
  );
}
