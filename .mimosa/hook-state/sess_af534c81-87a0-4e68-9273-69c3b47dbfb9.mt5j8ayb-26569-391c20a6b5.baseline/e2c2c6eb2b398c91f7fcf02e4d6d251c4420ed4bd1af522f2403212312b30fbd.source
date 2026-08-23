"use client";

import { SectionFigure } from "@/components/lesson/SectionFigure";
import type { SimSnapshot } from "@/engine/snapshot";
import type { NodeSpec } from "@/engine/types";
import type { ReactNode } from "react";
import { gossipSim, NODE_IDS, type GossipNodeMeta } from "./gossip";

/** SystemNode's box width — the badge centers on it. */
const NODE_W = 88;

type NodeRuntimeView = SimSnapshot["nodes"][string];

function readMeta(runtime: NodeRuntimeView): GossipNodeMeta | null {
  const meta = runtime.meta;
  if (!meta || typeof meta.infected !== "boolean") return null;
  return {
    infected: meta.infected,
    learnedRound: typeof meta.learnedRound === "number" ? meta.learnedRound : -1,
    heard: typeof meta.heard === "number" ? meta.heard : 0,
  };
}

/**
 * The infection badge — the one thing that has to be readable at a glance on
 * ten nodes at once: does this peer hold the rumor?
 *
 * A node that knows gets a filled amber dot and the round it learned in; a
 * node that doesn't gets a hollow ring and nothing else, because "no news" is
 * genuinely all there is to say about it. Once a node has heard the rumor more
 * than once the badge starts counting: ×4 on a ten-node cluster is the
 * redundancy of the whole protocol, printed on the node paying for it.
 *
 * Dead peers draw no badge at all. Whatever they knew went with them, and the
 * live cluster has no idea they are gone.
 */
function infectionBadge(_spec: NodeSpec, runtime: NodeRuntimeView): ReactNode {
  const meta = readMeta(runtime);
  if (!meta || runtime.health === "dead") return null;

  const known = meta.infected;
  const text = known
    ? meta.heard > 1
      ? `R${meta.learnedRound} ×${meta.heard}`
      : `R${meta.learnedRound}`
    : "";
  const color = known ? "var(--color-accent)" : "var(--color-fg-faint)";
  const w = known ? text.length * 5.4 + 22 : 16;

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
        stroke={known ? color : "var(--color-border-bright)"}
        strokeWidth={known ? 1 : 0.75}
        style={{ transition: "stroke 300ms" }}
      />
      <circle
        cx={known ? -w / 2 + 8 : 0}
        cy={0}
        r={known ? 3.2 : 2.6}
        fill={known ? color : "none"}
        stroke={known ? "none" : "var(--color-fg-faint)"}
        strokeWidth={1}
        opacity={known ? 1 : 0.6}
        style={{ transition: "fill 300ms, opacity 300ms" }}
      />
      {known && (
        <text
          x={w / 2 - 5}
          y={3.5}
          textAnchor="end"
          fill={color}
          style={{
            font: "600 9px var(--font-plex-mono)",
            letterSpacing: "0.04em",
          }}
        >
          {text}
        </text>
      )}
    </g>
  );
}

/* ---------------- epidemic curve ---------------- */

const PLATE_X = 12;
const PLATE_Y = 14;
const PLATE_W = 124;
const PLATE_H = 64;
const CHART_X = 10;
const CHART_Y = 26;
const CHART_W = 104;
const CHART_H = 28;
/** Columns drawn; older rounds scroll off the left. */
const CURVE_WINDOW = 24;

/**
 * The shape the lesson is actually about: how many nodes knew the rumor at the
 * start of each round. The meters give you the current number; only the curve
 * gives you 1, 3, 7, 10 — the near-vertical middle of an epidemic, followed by
 * the flat top where every message has become redundant.
 *
 * The sim samples it once per round (`series.curve`) and clears it whenever a
 * new rumor starts, so the plate always describes the rumor on the wire.
 */
function EpidemicPlate(snapshot: SimSnapshot) {
  const rumor = snapshot.metrics.rumor ?? 0;
  const round = snapshot.metrics.rounds ?? 0;
  const curve = (snapshot.series.curve ?? []).slice(-CURVE_WINDOW);
  const live = snapshot.metrics.live ?? NODE_IDS.length;
  const slot = CHART_W / CURVE_WINDOW;
  const barW = Math.max(2, slot - 1.6);
  // The whole cluster is the scale, so the top of the chart stays put when
  // nodes die — a shorter column after a kill is a real drop, not a rescale.
  const scale = (v: number) => (v / NODE_IDS.length) * CHART_H;

  return (
    <g transform={`translate(${PLATE_X} ${PLATE_Y})`} aria-hidden>
      <rect
        width={PLATE_W}
        height={PLATE_H}
        rx={8}
        fill="var(--color-raised)"
        stroke="var(--color-border-bright)"
        strokeWidth={0.75}
        opacity={0.95}
      />
      <text
        x={10}
        y={17}
        fill="var(--color-fg-faint)"
        style={{ font: "600 9px var(--font-plex-mono)", letterSpacing: "0.09em" }}
      >
        {rumor === 0 ? "NO RUMOR YET" : `RUMOR ${rumor} · ROUND ${round}`}
      </text>

      {/* Baseline: the number of nodes still up, i.e. what "everyone" means. */}
      <line
        x1={CHART_X}
        x2={CHART_X + CHART_W}
        y1={CHART_Y + CHART_H - scale(live)}
        y2={CHART_Y + CHART_H - scale(live)}
        stroke="var(--color-fg-faint)"
        strokeWidth={0.5}
        strokeDasharray="2 3"
        opacity={0.7}
      />
      <line
        x1={CHART_X}
        x2={CHART_X + CHART_W}
        y1={CHART_Y + CHART_H}
        y2={CHART_Y + CHART_H}
        stroke="var(--color-border-bright)"
        strokeWidth={0.75}
      />

      {curve.map((value, i) => {
        const h = Math.max(1, scale(value));
        return (
          <rect
            key={i}
            x={CHART_X + i * slot}
            y={CHART_Y + CHART_H - h}
            width={barW}
            height={h}
            rx={1}
            fill="var(--color-accent)"
            opacity={0.35 + 0.65 * (value / NODE_IDS.length)}
          />
        );
      })}
    </g>
  );
}

export function GossipFigure() {
  return (
    <SectionFigure
      sim={gossipSim}
      stageOverlay={EpidemicPlate}
      nodeOverlay={infectionBadge}
      // "Losing nodes mid-rumor" has no figure of its own: killing a peer in
      // this one is its subject, and the prediction checkpoint is the argument
      // that dead peers cannot slow the epidemic down much.
      completes={[
        { on: "node-kill", section: "lose-nodes" },
        { on: "quiz-answered", id: "go-rounds", section: "lose-nodes" },
      ]}
      description="Ten peer servers arranged in a ring, with every one of the 45 possible pairs drawn as a connection — the membership list, made of wire, because a gossip target can be any peer. A badge over each peer says whether it holds the current rumor: a filled amber dot with the round it learned in, and a multiplication count once it has been told more than once, or a hollow grey ring if it has not heard yet. Amber packets are rumor messages that will teach their receiver something new; grey packets are messages that will not, because the receiver already knows or is dead; cyan packets are pull requests asking whether there is anything new, which only appear in push-pull mode. The sender cannot tell those apart — the coloring is the observer's. A plate in the top-left shows which rumor is spreading, the round number, and a column chart of how many nodes knew at the start of each round, with a dashed line marking how many peers are still alive. Meters show nodes that know, gossip rounds, messages sent, and coverage of the live nodes. Controls set the fanout (peers told per round), push or push-pull mode, the round interval, and a button that starts a fresh rumor at n0; any peer can be clicked to kill or revive it."
    />
  );
}
