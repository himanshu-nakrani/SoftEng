"use client";

import { SectionFigure } from "@/components/lesson/SectionFigure";
import type { SimSnapshot } from "@/engine/snapshot";
import type { NodeSpec } from "@/engine/types";
import type { ReactNode } from "react";
import {
  leaderElectionSim,
  MAJORITY,
  NODE_IDS,
  type ElectionNodeMeta,
  type Role,
} from "./leader-election";

/** SystemNode's box width — the role badge centers on it. */
const NODE_W = 88;

type NodeRuntimeView = SimSnapshot["nodes"][string];

const ROLE_COLOR: Record<Role, string> = {
  leader: "var(--color-accent)",
  candidate: "var(--color-glow-orange)",
  follower: "var(--color-fg-muted)",
};

function readMeta(runtime: NodeRuntimeView): ElectionNodeMeta | null {
  const meta = runtime.meta;
  if (!meta || typeof meta.term !== "number") return null;
  const role = meta.role;
  return {
    role: role === "leader" || role === "candidate" ? role : "follower",
    term: meta.term,
    votes: typeof meta.votes === "number" ? meta.votes : 0,
    needed: typeof meta.needed === "number" ? meta.needed : MAJORITY,
  };
}

/**
 * The role badge over each peer — the only place the cluster's state is
 * legible at a glance: who leads, who is campaigning (and how many votes it
 * has actually collected, against the majority it needs), and the term every
 * one of them believes in. A dead node keeps its frozen term, dimmed, because
 * that is what it will wake up still believing.
 */
function roleBadge(_spec: NodeSpec, runtime: NodeRuntimeView): ReactNode {
  const meta = readMeta(runtime);
  if (!meta) return null;
  const dead = runtime.health === "dead";
  const role: Role = dead ? "follower" : meta.role;

  const text = dead
    ? `t${meta.term}`
    : role === "leader"
      ? `LEADER · t${meta.term}`
      : role === "candidate"
        ? `CAND ${meta.votes}/${meta.needed} · t${meta.term}`
        : `t${meta.term}`;
  const w = text.length * 5.4 + 12;
  const lit = !dead && role !== "follower";
  const color = dead ? "var(--color-fg-faint)" : ROLE_COLOR[role];

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
        stroke={lit ? color : "var(--color-border-bright)"}
        strokeWidth={lit ? 1 : 0.75}
        style={{ transition: "stroke 300ms" }}
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

/* ---------------- quorum plate ---------------- */

const PLATE_X = 22;
const PLATE_Y = 22;
const PLATE_W = 156;
const PLATE_H = 48;

/**
 * The scoreboard the whole lesson turns on: the majority is a fixed 3 of 5,
 * and a pip per node says who is still around to vote. When the live count
 * drops below the majority the plate goes red — no amount of agreement among
 * the survivors can produce a leader from there.
 */
function QuorumPlate(snapshot: SimSnapshot) {
  const live = NODE_IDS.filter(
    (id) => snapshot.nodes[id]?.health !== "dead",
  ).length;
  const ok = live >= MAJORITY;
  const edge = ok ? "var(--color-border-bright)" : "var(--color-glow-red)";

  return (
    <g transform={`translate(${PLATE_X} ${PLATE_Y})`} aria-hidden>
      <rect
        width={PLATE_W}
        height={PLATE_H}
        rx={8}
        fill="var(--color-raised)"
        stroke={edge}
        strokeWidth={ok ? 0.75 : 1}
        opacity={0.95}
        style={{ transition: "stroke 300ms" }}
      />
      <text
        x={12}
        y={18}
        fill="var(--color-fg-faint)"
        style={{
          font: "600 9px var(--font-plex-mono)",
          letterSpacing: "0.09em",
        }}
      >
        QUORUM · {MAJORITY} OF {NODE_IDS.length}
      </text>

      {NODE_IDS.map((id, i) => {
        const runtime = snapshot.nodes[id];
        const dead = runtime?.health === "dead";
        const meta = runtime ? readMeta(runtime) : null;
        const role: Role = dead ? "follower" : (meta?.role ?? "follower");
        return (
          <circle
            key={id}
            cx={16 + i * 14}
            cy={34}
            r={4.5}
            fill={dead ? "none" : ROLE_COLOR[role]}
            stroke={dead ? "var(--color-glow-red)" : "none"}
            strokeWidth={1}
            opacity={dead ? 0.55 : role === "follower" ? 0.55 : 1}
            style={{ transition: "fill 300ms, opacity 300ms" }}
          />
        );
      })}

      <text
        x={PLATE_W - 12}
        y={37.5}
        textAnchor="end"
        fill={ok ? "var(--color-fg-muted)" : "var(--color-glow-red)"}
        style={{
          font: "600 9px var(--font-plex-mono)",
          letterSpacing: "0.06em",
        }}
      >
        {ok ? `${live} LIVE` : "NO MAJORITY"}
      </text>
    </g>
  );
}

export function LeaderElectionFigure() {
  return (
    <SectionFigure
      sim={leaderElectionSim}
      stageOverlay={QuorumPlate}
      nodeOverlay={roleBadge}
      // The quorum section has no figure of its own — answering the checkpoint
      // that stages it (two survivors, no leader) is what completes it.
      completes={[{ on: "quiz-answered", id: "le-quorum", section: "quorum" }]}
      description="Five database peers arranged in a ring, fully connected, with an app connected to n1 on the left. A badge over each peer shows its role — LEADER, CAND with the votes it has collected out of the three it needs, or just its term number — and dead peers keep their frozen term. Small cyan packets are the leader's heartbeats to every live peer; each one resets that peer's randomized election timer. When a timer expires the peer becomes a candidate and sends violet RequestVote packets to all peers; green packets are granted votes, grey ones refusals. Amber packets are client writes, proxied from n1 to whichever peer currently leads and bounced red while there is no leader. A plate in the top-left shows the fixed majority of three of five, one pip per peer, and turns red when fewer than three peers are alive. Meters show the current term, elections won, writes rejected and live nodes."
    />
  );
}
