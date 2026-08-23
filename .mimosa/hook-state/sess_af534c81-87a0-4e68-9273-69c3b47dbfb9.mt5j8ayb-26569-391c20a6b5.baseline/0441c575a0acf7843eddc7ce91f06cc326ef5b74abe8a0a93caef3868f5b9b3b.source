"use client";

import { SectionFigure } from "@/components/lesson/SectionFigure";
import type { SimSnapshot } from "@/engine/snapshot";
import type { NodeSpec } from "@/engine/types";
import { twoPhaseCommitSim } from "./two-phase-commit";

type NodeRuntimeView = SimSnapshot["nodes"][string];

/* Node-local geometry, in the 88x60 box SystemNode draws in. The lock rail
   hangs *below* the box (the overlay slot explicitly allows y > 60), clear of
   the load bar at y=48 and the queue chip in the bottom-right corner. */
const RAIL_Y = 70;
const PIP_R = 3.5;
const PIP_X0 = 40;
const PIP_GAP = 11;

function metaNumber(meta: Record<string, unknown> | undefined, key: string): number {
  const value = meta?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/**
 * The lock rail: one pip per concurrent transaction a database can be bound
 * to, lit for each lock it is currently holding. This is the thing the whole
 * lesson is about — a YES voter cannot release these until the coordinator
 * tells it the outcome, so when the coordinator dies they simply stay lit.
 * Amber while the protocol is moving, warning-orange once the node is frozen
 * (SystemNode paints the same node's outline orange at that point).
 */
function LockRail({ runtime }: { runtime: NodeRuntimeView }) {
  const slots = metaNumber(runtime.meta, "slots");
  if (slots <= 0) return null;
  const held = metaNumber(runtime.meta, "locks");
  const frozen = runtime.health === "degraded";
  const lit = frozen ? "var(--color-glow-orange)" : "var(--color-accent)";

  return (
    <g aria-hidden>
      <text
        x={6}
        y={RAIL_Y + 3}
        fill="var(--color-fg-faint)"
        style={{ font: "600 7px var(--font-plex-mono)", letterSpacing: "0.1em" }}
      >
        LOCKS
      </text>
      {Array.from({ length: slots }, (_, i) => {
        const on = i < held;
        return (
          <circle
            key={i}
            cx={PIP_X0 + i * PIP_GAP}
            cy={RAIL_Y}
            r={PIP_R}
            fill={on ? lit : "none"}
            stroke={on ? lit : "var(--color-border-bright)"}
            strokeWidth={1}
            style={{
              transition: "fill 200ms, stroke 200ms",
              filter: on && frozen ? "drop-shadow(0 0 4px var(--color-glow-orange))" : undefined,
            }}
          />
        );
      })}
    </g>
  );
}

/**
 * The blocking window, named on the stage. It is not "the coordinator is
 * down" that hurts — it is that the outcome exists and nobody may act on it.
 */
function BlockingBanner(snapshot: SimSnapshot) {
  if (!snapshot.metrics.coordDown) return null;
  return (
    <g aria-hidden>
      <rect
        x={120}
        y={278}
        width={180}
        height={20}
        rx={4}
        fill="var(--color-bg)"
        stroke="var(--color-glow-red)"
        strokeWidth={1}
      />
      <text
        x={210}
        y={292}
        textAnchor="middle"
        fill="var(--color-glow-red)"
        style={{ font: "600 9px var(--font-plex-mono)", letterSpacing: "0.08em" }}
      >
        NO DECISION · LOCKS HELD
      </text>
    </g>
  );
}

export function TwoPhaseCommitFigure() {
  return (
    <SectionFigure
      sim={twoPhaseCommitSim}
      stageOverlay={BlockingBanner}
      nodeOverlay={(spec: NodeSpec, runtime) =>
        spec.kind === "database" ? <LockRail runtime={runtime} /> : null
      }
      // "coordinator-dies" has no figure of its own: springing the trap (or
      // predicting what the frozen participants can do) is the section.
      completes={[
        { on: "button-press", id: "killWorst", section: "coordinator-dies" },
        { on: "quiz-answered", id: "tpc-blocked", section: "coordinator-dies" },
      ]}
      description="A transaction coordinator fanning out to three participant databases. Each transaction runs as four visible rounds of packets: amber PREPARE out, green YES or red NO votes back, violet COMMIT (or orange ABORT, if any vote was NO) out, cyan ACK back. Pips under each database show the row locks it holds — taken when it votes YES, released only when the decision arrives. Sliders set the transaction rate and each participant's abort rate; a button kills the coordinator at the worst possible moment, the instant every vote has arrived and no decision has gone out. The participants then freeze holding their locks, turn orange, the blocked-transaction counter climbs and new transactions queue at the dead coordinator, until it recovers six seconds later, replays its log and releases them. Meters track commits, aborts, blocked transactions, end-to-end 2PC latency and the coordination tax over a single-machine round trip."
    />
  );
}
