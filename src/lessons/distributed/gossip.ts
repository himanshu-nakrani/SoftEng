import {
  advancePackets,
  approach,
  clamp01,
  isAlive,
  killNode,
  recordSample,
  spawnPacket,
} from "@/engine/sim-helpers";
import type { LessonSim, SimState } from "@/engine/types";

/**
 * Gossip Protocols — ten peers, no leader, and a rumor that reaches everyone
 * anyway.
 *
 * The deliberate contrast to the last lesson. There is no election here, no
 * term, no coordinator, no broadcast tree and no membership meeting. Every
 * node holds the same flat list of peers, and once a node learns something it
 * spends every round telling FANOUT peers picked at random. That is the entire
 * protocol, and it is enough: the number of nodes that know the rumor roughly
 * multiplies each round, so coverage costs O(log N) rounds — while the message
 * bill grows at N·k per round forever, most of it redundant. The redundancy is
 * not waste to be optimized away; it is the only reason the thing survives
 * dead nodes and lost packets without a single line of retry logic.
 *
 * THE TOPOLOGY IS THE POINT. All 45 pairs are drawn, because a gossip target
 * really is any peer in the membership list — so every message rides a real,
 * direct edge to the peer it was addressed to. Nothing is routed, relayed or
 * approximated onto a nearer wire. Chords bow outward by ring distance purely
 * so the mesh stays legible (an unbowed K10 knots at the centre).
 *
 * WHAT THE COLORS SAY. Amber = a message that will teach its receiver
 * something new. Grey = a message that will not: the peer already knows, or
 * the peer is dead. The sender cannot tell the two apart — it has no idea who
 * knows what, which is exactly why it must keep talking — but the *observer*
 * can, and watching the stage turn grey as coverage completes is the cost of
 * epidemic delivery, drawn.
 *
 * SIMPLIFICATIONS vs. real gossip (Cassandra, Serf/SWIM, Scuttlebutt):
 *   · One rumor at a time, no version vectors, no digests, no reconciliation.
 *     A real exchange trades a summary of everything each side holds.
 *   · Rounds are synchronized cluster-wide; real nodes each run their own
 *     ~1s timer with independent phase.
 *   · Push-pull is modelled as "each live node contacts k peers per round —
 *     if it knows, it pushes; if it doesn't, it asks" and a peer that is asked
 *     answers with what it has. Real push-pull does both directions in one
 *     exchange every round.
 *   · No message loss and no latency variance beyond wire length; the only
 *     failure modelled is a dead node.
 *   · Nodes gossip forever once a rumor exists. Real rumor-mongering variants
 *     stop spreading after hearing a rumor back a few times; membership gossip
 *     (the case this lesson describes) genuinely never stops.
 */

/* ---------------- Cluster shape ---------------- */

export const NODE_IDS = [
  "n0",
  "n1",
  "n2",
  "n3",
  "n4",
  "n5",
  "n6",
  "n7",
  "n8",
  "n9",
] as const;
export type Nid = (typeof NODE_IDS)[number];

/** Where the scripted rumor starts (and the button's preference). */
export const SEED_NODE: Nid = "n0";

/** Ellipse geometry in the 800x450 stage — pushed right of the round plate. */
const RING_CX = 420;
const RING_CY = 226;
const RING_RX = 250;
const RING_RY = 160;

/** Ring position of node `i`: n0 at 12 o'clock, the rest clockwise. */
function ringPos(i: number): { x: number; y: number } {
  const angle = -Math.PI / 2 + (i * 2 * Math.PI) / NODE_IDS.length;
  return {
    x: Math.round(RING_CX + Math.cos(angle) * RING_RX),
    y: Math.round(RING_CY + Math.sin(angle) * RING_RY),
  };
}

const POS = NODE_IDS.map((_, i) => ringPos(i));

/** Steps around the ring between two nodes, 1..5. */
function ringDistance(i: number, j: number): number {
  const d = Math.abs(i - j);
  return Math.min(d, NODE_IDS.length - d);
}

/**
 * Every pair, authored once in NODE_IDS order — the full membership list, made
 * of wire. Ring sides run straight; the further a chord reaches, the harder it
 * bows away from the centre, which is what keeps the middle of the stage open
 * enough to watch packets cross it.
 */
const BOW = [0, 0, 0.18, 0.26, 0.3, 0.34];

const PEER_EDGES = NODE_IDS.flatMap((a, i) =>
  NODE_IDS.slice(i + 1).map((b, j) => ({
    id: `${a}-${b}`,
    from: a,
    to: b,
    curve: BOW[ringDistance(i, i + 1 + j)],
  })),
);

function link(from: Nid, to: Nid): { edgeId: string; reverse: boolean } {
  const forward = NODE_IDS.indexOf(from) < NODE_IDS.indexOf(to);
  return {
    edgeId: forward ? `${from}-${to}` : `${to}-${from}`,
    reverse: !forward,
  };
}

/**
 * Flight time by wire length, not by edge. Packet speed is progress/sec on a
 * normalized path, so a fixed speed would fling a message across the diameter
 * (486px) in the same time a ring hop (150px) takes — three times the
 * apparent velocity. Dividing by length fixes the pixels/sec instead, clamped
 * so nothing crawls or teleports.
 */
const SPEED_PX = 700;
const EDGE_SPEED: Record<string, number> = Object.fromEntries(
  PEER_EDGES.map((e) => {
    const a = POS[NODE_IDS.indexOf(e.from as Nid)];
    const b = POS[NODE_IDS.indexOf(e.to as Nid)];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    return [e.id, Math.min(3, Math.max(1.6, SPEED_PX / len))];
  }),
);

/* ---------------- Lesson state ---------------- */

interface Peer {
  /** Holds the current rumor. */
  infected: boolean;
  /** Round it first heard the rumor; -1 while it hasn't. */
  learnedRound: number;
  /** Deliveries received, duplicates included — the redundancy, per node. */
  heard: number;
  /** Liveness as of last tick — how kills and reboots are detected. */
  wasAlive: boolean;
}

interface GossipState {
  peers: Record<Nid, Peer>;
  /**
   * Bumped every time a rumor starts. Packets carry the id they were spawned
   * for, so messages still in flight from the previous rumor die on arrival
   * instead of re-infecting the cluster with old news.
   */
  rumorId: number;
  /** Sim-seconds banked toward the next gossip round. */
  roundAcc: number;
  /** Rounds since THIS rumor started. */
  rounds: number;
  /** Messages sent for THIS rumor, redundant ones included. */
  messages: number;
  /** Deliveries to a node that already knew. */
  duplicates: number;
  /** Messages that reached a dead node, or a probe nobody could answer. */
  lost: number;
  /** Sim-seconds since the rumor started (drives caption gates). */
  age: number;
  /** True once every live node has held the rumor at the same moment. */
  covered: boolean;
  /** Rounds it took to get there (-1 until it does). */
  coveredAtRound: number;
  /**
   * `messages` and `age` FROZEN at the moment coverage completed. The live
   * counters keep climbing afterwards (gossip never stops), so a caption gate
   * written against them would open and shut as the run went on; these two
   * are stable, which is what makes the gates below mutually exclusive.
   */
  coveredMessages: number;
  coveredAge: number;
}

/** What the figure draws over each node. */
export interface GossipNodeMeta {
  infected: boolean;
  learnedRound: number;
  heard: number;
}

const peer = (): Peer => ({
  infected: false,
  learnedRound: -1,
  heard: 0,
  wasAlive: true,
});

/**
 * Start a fresh rumor: everyone forgets, the seed node learns it, and the
 * per-rumor counters reset. The sim CLOCK is untouched — a new rumor is an
 * event in an already-running cluster, not a restart.
 */
function startRumor(state: SimState<GossipState>): void {
  const L = state.lesson;
  L.rumorId += 1;
  L.rounds = 0;
  L.messages = 0;
  L.duplicates = 0;
  L.lost = 0;
  L.age = 0;
  L.roundAcc = 0;
  L.covered = false;
  L.coveredAtRound = -1;
  L.coveredMessages = 0;
  L.coveredAge = 0;
  state.series.curve = [];
  for (const id of NODE_IDS) {
    const p = L.peers[id];
    p.infected = false;
    p.learnedRound = -1;
    p.heard = 0;
  }
  // Prefer n0 so the narration always names the same node; if the learner has
  // killed it, the first live peer carries the news instead.
  const seed = isAlive(state, SEED_NODE)
    ? SEED_NODE
    : NODE_IDS.find((id) => isAlive(state, id));
  if (seed) {
    L.peers[seed].infected = true;
    L.peers[seed].learnedRound = 0;
  }
}

/** k distinct peers, uniform over the whole membership list. */
function pickPeers(state: SimState<GossipState>, self: Nid, k: number): Nid[] {
  const pool: Nid[] = NODE_IDS.filter((id) => id !== self);
  const take = Math.min(k, pool.length);
  const picked: Nid[] = [];
  for (let i = 0; i < take; i++) {
    // Partial Fisher-Yates: one RNG draw per pick, no rejection loop (which
    // would burn a variable number of draws and break replay).
    const j = i + Math.floor(state.rng() * (pool.length - i));
    const swap = pool[i];
    pool[i] = pool[j];
    pool[j] = swap;
    picked.push(pool[i]);
  }
  return picked;
}

/**
 * The scripted failure: two peers, opposite sides of the ring, chosen from a
 * preference list so the beat still takes out exactly two even if the learner
 * has already killed one of them. n0 is spared — the scripted rumor is seeded
 * there, and a rumor that never starts teaches nothing.
 */
const KILL_ORDER: Nid[] = ["n3", "n7", "n5", "n2", "n8", "n1", "n4", "n6", "n9"];

function killTwo(s: SimState<GossipState>): void {
  let remaining = 2;
  for (const id of KILL_ORDER) {
    if (remaining === 0) break;
    if (!isAlive(s, id)) continue;
    killNode(s, id);
    remaining -= 1;
  }
}

const liveCount = (s: SimState<GossipState>) =>
  NODE_IDS.filter((id) => isAlive(s, id)).length;

const infectedCount = (s: SimState<GossipState>) =>
  NODE_IDS.filter((id) => isAlive(s, id) && s.lesson.peers[id].infected).length;

/** One gossip round: every node that has something to say, says it. */
function gossipRound(
  state: SimState<GossipState>,
  k: number,
  pushPull: boolean,
): void {
  const L = state.lesson;
  for (const id of NODE_IDS) {
    if (!isAlive(state, id)) continue;
    const p = L.peers[id];
    // Push: only nodes holding the rumor talk. Push-pull: everyone talks —
    // the ignorant ones by asking.
    if (!p.infected && !pushPull) continue;

    for (const target of pickPeers(state, id, k)) {
      L.messages += 1;
      const { edgeId, reverse } = link(id, target);
      const speed = EDGE_SPEED[edgeId];
      const payload = { to: target, from: id, rumor: L.rumorId, pull: !p.infected };
      if (p.infected) {
        // The SENDER cannot know whether this teaches anything — it has no
        // idea who knows what. The observer can, so the dot is colored by
        // what it is about to be worth.
        const useful = isAlive(state, target) && !L.peers[target].infected;
        spawnPacket(state, edgeId, useful ? "rumor" : "spent", {
          speed,
          reverse,
          payload,
        });
      } else {
        spawnPacket(state, edgeId, "probe", { speed, reverse, payload });
      }
    }
  }
}

export const gossipSim: LessonSim<GossipState> = {
  id: "gossip",

  topology: {
    nodes: NODE_IDS.map((id, i) => ({
      id,
      kind: "server" as const,
      label: id,
      ...POS[i],
      breakable: true,
    })),
    edges: PEER_EDGES,
  },

  packetStyles: {
    // The rumor itself is the lesson's primary traffic — brand amber.
    rumor: { color: "var(--color-accent)" },
    // Redundant or lost: a message that changed nothing. Grey, not red —
    // nothing failed here, and this is most of the traffic by design.
    spent: { color: "var(--color-fg-faint)", size: 3 },
    // "Anything new?" — informational, so the demoted hue.
    probe: { color: "var(--color-glow-cyan)", size: 3 },
  },

  packetLegend: [
    { type: "rumor", label: "rumor — teaches the receiver something" },
    { type: "spent", label: "redundant — it already knew (or it's dead)" },
    { type: "probe", label: "pull — “anything new?”" },
  ],

  initialNodes: Object.fromEntries(
    NODE_IDS.map((id) => [
      id,
      { meta: { infected: false, learnedRound: -1, heard: 0 } },
    ]),
  ),

  params: [
    {
      key: "fanout",
      label: "fanout (peers per round)",
      kind: "slider",
      min: 1,
      max: 4,
      step: 1,
      defaultValue: 2,
    },
    {
      key: "mode",
      label: "gossip mode",
      kind: "select",
      options: [
        { value: "push", label: "push" },
        { value: "push-pull", label: "push-pull" },
      ],
      defaultValue: "push",
    },
    {
      key: "interval",
      label: "round interval",
      kind: "slider",
      min: 0.5,
      max: 1.6,
      step: 0.1,
      unit: "s",
      defaultValue: 0.9,
    },
    {
      key: "startRumor",
      label: "start a new rumor",
      kind: "button",
      defaultValue: false,
    },
  ],

  init: () => ({
    peers: Object.fromEntries(NODE_IDS.map((id) => [id, peer()])) as Record<
      Nid,
      Peer
    >,
    rumorId: 0,
    roundAcc: 0,
    rounds: 0,
    messages: 0,
    duplicates: 0,
    lost: 0,
    age: 0,
    covered: false,
    coveredAtRound: -1,
    coveredMessages: 0,
    coveredAge: 0,
  }),

  step: (state, dt, params) => {
    const L = state.lesson;
    const k = Math.max(1, Math.min(4, Math.round(Number(params.fanout))));
    const pushPull = params.mode === "push-pull";
    const interval = Number(params.interval);

    // 0. The momentary button — a brand new rumor in a cluster that never
    //    stopped running.
    if (params.startRumor === true) {
      params.startRumor = false; // consume the press
      startRumor(state);
    }

    // 1. Membership. Nobody announces a death and nobody announces a reboot:
    //    a node that comes back is simply a node that knows nothing, and the
    //    next round it is asked or told will fix that. That is anti-entropy,
    //    and it costs no code at all.
    for (const id of NODE_IDS) {
      const p = L.peers[id];
      const alive = isAlive(state, id);
      if (alive !== p.wasAlive) {
        p.wasAlive = alive;
        p.infected = false;
        p.learnedRound = -1;
        p.heard = 0;
      }
    }

    // 2. Rounds. Nothing is sent until there is something to send; before the
    //    first rumor the cluster sits quiet so the epidemic is legible.
    if (L.rumorId > 0) {
      L.age += dt;
      L.roundAcc += dt;
      if (L.roundAcc >= interval) {
        L.roundAcc -= interval;
        L.rounds += 1;
        // Sampled at the top of the round: what the PREVIOUS round achieved.
        recordSample(state, "curve", infectedCount(state), 26);
        gossipRound(state, k, pushPull);
      }
    }

    // 3. Deliveries.
    for (const p of advancePackets(state, dt)) {
      const to = p.payload?.to as Nid | undefined;
      const from = p.payload?.from as Nid | undefined;
      // Old news: a message spawned for a rumor that has since been replaced.
      if (p.payload?.rumor !== L.rumorId) continue;
      if (!to || !isAlive(state, to)) {
        // Into a corpse. Nobody notices, nobody retries, and the sender will
        // keep picking this peer for as long as the cluster runs.
        L.lost += 1;
        continue;
      }
      const target = L.peers[to];

      if (p.payload?.pull === true) {
        // A probe: the peer answers with the rumor if it has one to give.
        if (target.infected && from) {
          L.messages += 1;
          const useful = isAlive(state, from) && !L.peers[from].infected;
          spawnPacket(state, p.edgeId, useful ? "rumor" : "spent", {
            speed: p.speed,
            reverse: !p.reverse,
            payload: { to: from, from: to, rumor: L.rumorId, pull: false },
          });
        } else {
          L.lost += 1; // two ignorant nodes have nothing to trade
        }
        continue;
      }

      target.heard += 1;
      if (target.infected) {
        L.duplicates += 1;
      } else {
        target.infected = true;
        target.learnedRound = L.rounds;
      }
    }

    // 4. Readouts. Coverage is measured against the nodes that are still UP:
    //    a dead node is not a gap in the rumor's reach, it is gone. It leaves
    //    the numerator and the denominator together.
    const live = liveCount(state);
    const infected = infectedCount(state);
    if (!L.covered && live > 0 && infected === live && L.rumorId > 0) {
      L.covered = true;
      L.coveredAtRound = L.rounds;
      L.coveredMessages = L.messages;
      L.coveredAge = L.age;
    }

    for (const id of NODE_IDS) {
      const p = L.peers[id];
      const node = state.nodes[id];
      node.meta = {
        infected: p.infected,
        learnedRound: p.learnedRound,
        heard: p.heard,
      } satisfies GossipNodeMeta;
      if (!isAlive(state, id)) {
        node.load = 0;
        continue;
      }
      // A gossiping node is doing k sends a round and answering whatever
      // arrives; a quiet one is only listening. The bar tracks the send RATE
      // (k per interval), so tightening the interval costs the same as
      // widening the fanout — which is exactly the trade it is.
      const busy = L.rumorId > 0 && (p.infected || pushPull);
      const target = busy ? clamp01(0.06 + k / interval / 12) : 0.05;
      node.load = approach(node.load, target, 4, dt);
    }

    state.metrics.infected = infected;
    state.metrics.live = live;
    state.metrics.coverage = live > 0 ? (infected / live) * 100 : 0;
    state.metrics.rounds = L.rounds;
    // The overlay's title reads this: which rumor is on the wire (0 = none).
    state.metrics.rumor = L.rumorId;
    state.metrics.messages = L.messages;
    // Not metered, but the honest breakdown behind MESSAGES SENT: how much of
    // the bill told somebody something they already knew, and how much went
    // to a node that is not there any more.
    state.metrics.duplicates = L.duplicates;
    state.metrics.lost = L.lost;
  },

  timeline: [
    {
      at: 0.4,
      caption:
        "Ten peers. No leader, no coordinator, no broadcast tree — every node holds the same flat list of the other nine, and nothing else.",
    },
    {
      at: 4,
      apply: startRumor,
      caption:
        "n0 just learned something — a node joined, a key moved, a schema changed. Nobody else knows yet, and nobody is going to be told to tell them.",
    },
    {
      at: 6.4,
      caption:
        "Every node that knows tells FANOUT random peers each round, so the group that knows MULTIPLIES. Nobody scheduled that: there is no tree, no work queue, no owner.",
    },
    {
      /**
       * Both of these wait for full coverage rather than a clock moment, so
       * the number they quote is the number on the meters. The specific one
       * pins the seeded default run exactly (3 rounds, 22 messages); any run
       * the learner has already meddled with falls through to its generic
       * twin. The gates are mutually exclusive, so exactly one fires.
       */
      at: 5,
      when: (s) =>
        s.lesson.rumorId === 1 &&
        s.lesson.covered &&
        s.lesson.coveredAtRound === 3 &&
        s.lesson.coveredMessages === 22,
      caption:
        "Ten of ten, in three rounds — and it took 22 messages to move one fact to nine nodes. The surplus IS the reliability; it is not overhead waiting to be tuned away.",
    },
    {
      at: 5,
      when: (s) =>
        s.lesson.rumorId === 1 &&
        s.lesson.covered &&
        !(s.lesson.coveredAtRound === 3 && s.lesson.coveredMessages === 22),
      caption:
        "Everyone knows. Now read MESSAGES SENT against the number of nodes: most of that traffic taught nobody anything, and that surplus is exactly what makes the delivery robust.",
    },
    {
      // Only for a learner who actually ran FANOUT 1 and watched it struggle;
      // it cannot fire in the default seeded run.
      at: 8,
      when: (s, p) =>
        p.fanout === 1 && s.lesson.rounds >= 7 && !s.lesson.covered,
      caption:
        "Seven rounds in and still not everywhere. At FANOUT 1 a node's single pick lands on someone who already knows about as often as not — the tail of an epidemic is always the slow part.",
    },
    {
      // Only worth saying while the first rumor is still the subject; a run
      // slow enough to still be spreading at 12.8s skips this beat rather
      // than colliding with the kills.
      at: 11,
      when: (s) =>
        s.lesson.covered &&
        s.lesson.age - s.lesson.coveredAge >= 2 &&
        s.t < 12.8,
      caption:
        "The rumor is everywhere, and the traffic never stops — every grey dot is a node telling a peer something it already knew. Gossip cannot tell; that is why it keeps talking.",
    },
    {
      at: 13,
      apply: killTwo,
      caption:
        "☠ Two nodes just died. Nobody reroutes, nobody re-elects, nobody holds a membership meeting — the senders keep picking them, and those messages simply stop being worth anything.",
    },
    {
      at: 15.5,
      apply: startRumor,
      caption:
        "A fresh rumor at n0, with two of the ten gone. Watch it flow around the holes — the protocol has no idea they are there.",
    },
    {
      // Waits for the second rumor to finish, whenever that is: at the default
      // it lands a beat after coverage, at FANOUT 1 several seconds later.
      at: 20,
      when: (s) => s.lesson.rumorId >= 2 && s.lesson.covered,
      caption:
        "Every live node has it, in about the round count ten needed — and the messages that keep landing on the dead ones are simply lost. No error, no retry, no failover, no election: compare that to the last lesson.",
    },
    {
      at: 24,
      caption:
        "⚙ Your turn: drop FANOUT to 1 and press START A NEW RUMOR — one friend a round crawls, and unlucky picks stall it for whole rounds. Push it to 4: over in two rounds, at four times the traffic from then on.",
    },
    {
      at: 28,
      caption:
        "☠ Kill as many as you like, then revive one. Nothing announces the reboot: it comes back knowing nothing, somebody happens to pick it, and it is caught up. That is anti-entropy.",
    },
  ],

  quiz: [
    {
      id: "go-rounds",
      // One round has landed: exactly 3 of 10 know and the wires are empty —
      // the cleanest moment to ask, and the next two rounds are the proof.
      at: 5.6,
      question:
        "Fanout is 2, and 3 of the 10 nodes now know the rumor. Every node that knows tells 2 random peers per round. Roughly how many more rounds until all 10 know?",
      choices: [
        {
          id: "two",
          label: "About 2 — the group that knows multiplies every round",
        },
        {
          id: "six",
          label: "About 6 — a couple more nodes learn it each round",
        },
        {
          id: "one",
          label: "1 — three nodes sending two messages each covers the rest",
        },
      ],
      correctChoiceId: "two",
      explain:
        "Epidemics multiply. Three knowers send six messages, so the group jumps to seven, and the next round mops up the stragglers: 10 of 10 after three rounds in this run. That is the O(log N) result — 100 nodes take about 7 rounds, 1,000 about 10, a million about 20, and none of those numbers depend on anyone being in charge. Answer 3 is the trap worth naming: six messages for seven remaining nodes is not enough even before you count collisions, and two of those six landed on nodes that already knew. That duplication is the price and it never goes away — watch the amber dots turn grey as coverage fills in. Gossip has no idea who knows what, so it cannot aim; it buys certainty with surplus, and the same surplus is what lets it shrug off dead nodes and lost packets without a line of retry logic.",
    },
  ],

  meters: [
    {
      metricKey: "infected",
      label: "nodes that know",
      kind: "bar",
      max: NODE_IDS.length,
    },
    { metricKey: "rounds", label: "gossip rounds", kind: "counter" },
    { metricKey: "messages", label: "messages sent", kind: "counter" },
    {
      metricKey: "coverage",
      label: "coverage of live",
      kind: "gauge",
      max: 100,
      unit: "%",
    },
  ],
};
