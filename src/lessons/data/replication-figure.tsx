"use client";

import { SectionFigure } from "@/components/lesson/SectionFigure";
import type { SimSnapshot } from "@/engine/snapshot";
import type { NodeSpec } from "@/engine/types";
import type { ReactNode } from "react";
import { replicationSim, type ReplNodeMeta } from "./replication";

/** SystemNode's box width — the badge centers on it. */
const NODE_W = 88;

type NodeRuntimeView = SimSnapshot["nodes"][string];

function readMeta(runtime: NodeRuntimeView): ReplNodeMeta | null {
  const meta = runtime.meta;
  if (!meta || typeof meta.version !== "number") return null;
  return {
    version: meta.version,
    role: meta.role === "leader" ? "leader" : "replica",
  };
}

/**
 * The version badge, hung above each database box: the number every caption
 * and meter in this lesson talks about, plus who currently holds the leader
 * role. That second half is the whole point at t=25 — the LEADER tag moves to
 * a box still labelled `replica-1`, because names are identities and roles
 * are not.
 */
function versionBadge(_spec: NodeSpec, runtime: NodeRuntimeView): ReactNode {
  const meta = readMeta(runtime);
  if (!meta) return null;
  const leader = meta.role === "leader";
  const text = leader ? `LEADER v${meta.version}` : `v${meta.version}`;
  const w = text.length * 5.4 + 12;
  const accent = leader ? "var(--color-accent)" : "var(--color-fg-muted)";

  // -13 clears SystemNode's own chrome: the dead-cross badge starts at y=-5.
  return (
    <g transform={`translate(${NODE_W / 2} -13)`}>
      <rect
        x={-w / 2}
        y={-7}
        width={w}
        height={14}
        rx={7}
        fill="var(--color-raised)"
        stroke={leader ? "var(--color-accent)" : "var(--color-border-bright)"}
        strokeWidth={leader ? 1 : 0.75}
      />
      <text
        y={3.5}
        textAnchor="middle"
        fill={accent}
        style={{ font: "600 9px var(--font-plex-mono)", letterSpacing: "0.04em" }}
      >
        {text}
      </text>
    </g>
  );
}

export function ReplicationFigure() {
  return (
    <SectionFigure
      sim={replicationSim}
      nodeOverlay={versionBadge}
      // "stale-reads" has no figure of its own; stretching the replication lag
      // (or answering either checkpoint) is what demonstrates it.
      completes={[
        { on: "param-change", id: "lag", section: "stale-reads" },
        { on: "quiz-answered", id: "read-your-writes", section: "stale-reads" },
        { on: "quiz-answered", id: "repl-lost-writes", section: "stale-reads" },
      ]}
      description="A leader database receiving writes while two replicas trail behind by a configurable replication lag. Reads round-robin the live replicas; orange responses mark stale reads. Any node can be killed; at t=22 the leader dies and a replica is promoted, losing the writes that never replicated. Meters show the leader version, average replica lag, stale-read percentage and lost writes."
    />
  );
}
