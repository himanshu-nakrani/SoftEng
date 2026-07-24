import { advancePackets, approach, spawnPacket } from "@/engine/sim-helpers";
import type { LessonSim, SimState } from "@/engine/types";

/**
 * B5 — Leader Election, Raft-lite. Five nodes, one leader sending violet
 * heartbeats. Kill the leader: randomized election timeouts race, the
 * first to expire campaigns (amber vote requests), a majority of the
 * TOTAL cluster (3 of 5) elects. Kill three nodes and no quorum exists —
 * the cluster chooses unavailability over split-brain.
 *
 * Believable, not actual Raft: no logs, no pre-vote, single vote per term.
 */

const NODES = ["n1", "n2", "n3", "n4", "n5"] as const;
type Nid = (typeof NODES)[number];
const QUORUM = 3; // majority of TOTAL cluster size, dead or alive

type Role = "follower" | "candidate" | "leader";

interface NodeSim {
  role: Role;
  term: number;
  /** Highest term this node has granted a vote in. */
  votedInTerm: number;
  votes: number;
  lastHeartbeat: number;
  /** Randomized election timeout — the tie-breaker of the whole design. */
  timeoutLen: number;
  roleSince: number;
}

interface ElectionState {
  nodes: Record<Nid, NodeSim>;
  lastLeaderSend: number;
}

const HEARTBEAT_EVERY = 0.8;
const MSG_SPEED = 2.2;

/** Full-mesh edge id between two nodes (canonical order). */
function edgeBetween(a: Nid, b: Nid): { id: string; reverse: boolean } {
  const [lo, hi] = a < b ? [a, b] : [b, a];
  return { id: `m-${lo}-${hi}`, reverse: a > b };
}

function send(
  state: SimState<ElectionState>,
  from: Nid,
  to: Nid,
  type: "heartbeat" | "request" | "response",
  payload: Record<string, unknown>,
) {
  const { id, reverse } = edgeBetween(from, to);
  spawnPacket(state, id, type, {
    speed: MSG_SPEED,
    reverse,
    size: type === "heartbeat" ? 3 : 4,
    payload: { ...payload, from, to },
  });
}

function freshTimeout(rng: () => number): number {
  return 2.2 + rng() * 1.6;
}

function alive(state: SimState<ElectionState>, id: Nid): boolean {
  return state.nodes[id].health !== "dead";
}

// Pentagon layout, hand-placed.
const COORDS: Record<Nid, { x: number; y: number }> = {
  n1: { x: 400, y: 80 },
  n2: { x: 545, y: 190 },
  n3: { x: 490, y: 360 },
  n4: { x: 310, y: 360 },
  n5: { x: 255, y: 190 },
};

const MESH_EDGES = [] as { id: string; from: string; to: string }[];
for (let i = 0; i < NODES.length; i++) {
  for (let j = i + 1; j < NODES.length; j++) {
    MESH_EDGES.push({
      id: `m-${NODES[i]}-${NODES[j]}`,
      from: NODES[i],
      to: NODES[j],
    });
  }
}

export const leaderElectionSim: LessonSim<ElectionState> = {
  id: "leader-election",

  topology: {
    nodes: NODES.map((id, i) => ({
      id,
      kind: "database" as const,
      label: `node-${i + 1}`,
      x: COORDS[id].x,
      y: COORDS[id].y,
      breakable: true,
    })),
    edges: MESH_EDGES,
  },

  params: [
    {
      key: "chaos",
      label: "kill a random node",
      kind: "button",
      defaultValue: false,
    },
  ],

  init: (rng) => ({
    nodes: Object.fromEntries(
      NODES.map((id) => [
        id,
        {
          role: "follower" as Role,
          term: 0,
          votedInTerm: 0,
          votes: 0,
          lastHeartbeat: 0,
          timeoutLen: freshTimeout(rng),
          roleSince: 0,
        },
      ]),
    ) as Record<Nid, NodeSim>,
    lastLeaderSend: -1,
  }),

  step: (state, dt, params) => {
    const L = state.lesson;

    // Chaos button: kill a random alive node.
    if (params.chaos === true) {
      params.chaos = false;
      const candidates = NODES.filter((id) => alive(state, id));
      if (candidates.length > 0) {
        const victim =
          candidates[Math.floor(state.rng() * candidates.length)];
        state.nodes[victim].health = "dead";
      }
    }

    // Revived nodes (via click) rejoin as followers with a fresh timeout.
    for (const id of NODES) {
      const node = L.nodes[id];
      if (!alive(state, id) && node.role !== "follower") {
        node.role = "follower";
        node.votes = 0;
      }
      if (alive(state, id) && node.lastHeartbeat < 0) {
        node.lastHeartbeat = state.t;
      }
      if (!alive(state, id)) node.lastHeartbeat = -1;
    }

    // 1. Leader duties: periodic heartbeats to everyone.
    for (const id of NODES) {
      const node = L.nodes[id];
      if (node.role === "leader" && alive(state, id)) {
        if (state.t - L.lastLeaderSend >= HEARTBEAT_EVERY) {
          L.lastLeaderSend = state.t;
          for (const other of NODES) {
            if (other !== id) {
              send(state, id, other, "heartbeat", { term: node.term });
            }
          }
        }
      }
    }

    // 2. Election timeouts: followers with silence, candidates that stalled.
    for (const id of NODES) {
      const node = L.nodes[id];
      if (!alive(state, id) || node.role === "leader") continue;
      const silence = state.t - node.lastHeartbeat;
      const stalled =
        node.role === "candidate" && state.t - node.roleSince > node.timeoutLen;
      if ((node.role === "follower" && silence > node.timeoutLen) || stalled) {
        // Campaign: new term, vote for self, ask everyone else.
        node.role = "candidate";
        node.roleSince = state.t;
        node.term += 1;
        node.votedInTerm = node.term;
        node.votes = 1;
        node.timeoutLen = freshTimeout(state.rng);
        node.lastHeartbeat = state.t;
        for (const other of NODES) {
          if (other !== id) {
            send(state, id, other, "request", { term: node.term });
          }
        }
      }
    }

    // 3. Message deliveries.
    for (const p of advancePackets(state, dt)) {
      const to = p.payload?.to as Nid | undefined;
      const from = p.payload?.from as Nid | undefined;
      const term = Number(p.payload?.term ?? 0);
      if (!to || !from || !alive(state, to)) continue; // corpses don't vote
      const node = L.nodes[to];

      if (p.type === "heartbeat") {
        if (term >= node.term) {
          // Legitimate authority: adopt and follow.
          node.term = term;
          node.role = "follower";
          node.votes = 0;
          node.lastHeartbeat = state.t;
        }
      } else if (p.type === "request") {
        // Vote request: grant one vote per term, reset own clock.
        if (term > node.votedInTerm && node.role !== "leader") {
          node.votedInTerm = term;
          node.term = Math.max(node.term, term);
          node.lastHeartbeat = state.t;
          send(state, to, from, "response", { term });
        }
      } else if (p.type === "response") {
        // A vote arrives at the candidate.
        if (node.role === "candidate" && term === node.term) {
          node.votes += 1;
          if (node.votes >= QUORUM) {
            node.role = "leader";
            L.lastLeaderSend = -1; // heartbeat immediately next tick
          }
        }
      }
    }

    // 4. Readouts.
    let leaderId: Nid | null = null;
    let maxTerm = 0;
    let aliveCount = 0;
    for (const id of NODES) {
      const node = L.nodes[id];
      maxTerm = Math.max(maxTerm, node.term);
      if (alive(state, id)) aliveCount += 1;
      if (node.role === "leader" && alive(state, id)) leaderId = id;

      state.nodes[id].queueDepth = node.term;
      const targetLoad =
        !alive(state, id) ? 0
        : node.role === "leader" ? 1
        : node.role === "candidate" ? 0.55
        : 0.12;
      state.nodes[id].load = approach(state.nodes[id].load, targetLoad, 8, dt);
    }
    state.metrics.term = maxTerm;
    state.metrics.aliveCount = aliveCount;
    state.metrics.hasLeader = leaderId ? 100 : 0;
  },

  timeline: [
    {
      at: 4,
      caption:
        "One node's timeout expired first — it campaigned, won 3+ votes, and now rules by violet heartbeat. Full load bar = the leader.",
    },
    {
      at: 10,
      caption: "☠ The leader just died. Silence… then the timeouts race.",
      apply: (s) => {
        for (const id of NODES) {
          if (s.lesson.nodes[id].role === "leader") {
            s.nodes[id].health = "dead";
          }
        }
      },
    },
    {
      at: 16,
      caption:
        "A new term, a new leader — no human involved. Now click nodes: kill a second… then a third.",
    },
  ],

  quiz: [
    {
      id: "quorum",
      at: 13,
      question:
        "The cluster is 5 nodes and 2 are now dead. Can the remaining 3 elect a leader?",
      choices: [
        {
          id: "yes",
          label: "Yes — 3 votes is a majority of the FULL cluster of 5",
        },
        { id: "no", label: "No — elections need every node's vote" },
        { id: "old", label: "Only if the old leader comes back" },
      ],
      correctChoiceId: "yes",
      explain:
        "Quorum is a majority of the total membership (3 of 5) — not of whoever's currently alive. That constant is the safety proof: two majorities can't exist at once, so two leaders can't either. It's also the cost: lose 3 of 5 and the survivors — though perfectly healthy — refuse to elect. Unavailable beats split-brain.",
    },
  ],

  meters: [
    {
      metricKey: "hasLeader",
      label: "cluster has leader",
      kind: "gauge",
      max: 100,
      unit: "%",
      dangerBelow: 50,
    },
    {
      metricKey: "term",
      label: "term",
      kind: "counter",
    },
    {
      metricKey: "aliveCount",
      label: "alive",
      kind: "counter",
      unit: " / 5",
      dangerBelow: 2.5,
    },
  ],
};
