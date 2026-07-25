import {
  advancePackets,
  approach,
  bounceDrop,
  clamp01,
  emaRate,
  isAlive,
  killNode,
  reviveNode,
  shouldSpawn,
  spawnPacket,
} from "@/engine/sim-helpers";
import type { LessonSim, Packet, SimState } from "@/engine/types";

/**
 * Leader Election — five peers, one leader, and the race that replaces it.
 *
 * A Raft-flavoured cluster, simplified honestly (see SIMPLIFICATIONS below).
 * Every node holds a role and a term. The leader sends heartbeats (cyan) to
 * every live peer; each heartbeat a follower receives RESETS that follower's
 * randomized election timer. That is the whole mechanism: a leader stays
 * leader only by talking often enough.
 *
 * Stop the heartbeats — kill the leader, or stretch the interval past the
 * timeout — and some follower's timer expires first. It becomes a candidate,
 * bumps the term, and asks everyone for a vote (violet). Grants come back
 * green, refusals grey. Three of five ends the election; two of five does not,
 * however many nodes are still alive. That last sentence is the lesson.
 *
 * Client writes (amber) enter at n1 and are proxied to whoever holds the
 * leader role, so the write path visibly re-routes every time leadership
 * moves — and bounces red for the second or two when nobody holds it. Those
 * bounces are the price of an election, counted in WRITES REJECTED.
 *
 * SIMPLIFICATIONS vs. real Raft — what this sim deliberately does not model:
 *   · No replicated log. Heartbeats carry a term and nothing else; there are
 *     no log indices, no AppendEntries, no commit index, no matchIndex.
 *   · No up-to-date-log check on votes. Real voters refuse a candidate whose
 *     log is behind theirs (Raft §5.4); here any peer with a free vote grants.
 *   · No persistence, no snapshots, no membership changes, no pre-vote.
 *   · One randomized timer per node, drawn from [T, 2T) — Raft's own trick,
 *     just at human speed (seconds, not the 150-300ms of a real cluster).
 *   · Message loss isn't modelled; the only failure is a dead node.
 */

/* ---------------- Cluster shape ---------------- */

export const NODE_IDS = ["n1", "n2", "n3", "n4", "n5"] as const;
export type Nid = (typeof NODE_IDS)[number];

/** Votes an election needs. A property of the CLUSTER, never of the survivors. */
export const MAJORITY = Math.floor(NODE_IDS.length / 2) + 1;

/** Ring geometry in the 800x450 stage — the app sits to its left. */
const RING_CX = 505;
const RING_CY = 225;
const RING_R = 152;

/** Ring position of node `i`: n1 at 9 o'clock, the rest clockwise. */
function ringPos(i: number): { x: number; y: number } {
  const angle = Math.PI + (i * 2 * Math.PI) / NODE_IDS.length;
  return {
    x: Math.round(RING_CX + Math.cos(angle) * RING_R),
    y: Math.round(RING_CY + Math.sin(angle) * RING_R),
  };
}

/**
 * The node the app holds its connection to. Writes enter the cluster here and
 * are proxied onward to the leader — which is what a client library that
 * knows only one peer really does. Kill n1 and the app has nowhere to send;
 * every scripted failure below deliberately spares it so the leaderless
 * bounces always read as "no leader", never as "no route".
 */
export const CONTACT: Nid = "n1";
const CLIENT_EDGE = "app-n1";

/**
 * The peer mesh: every pair of nodes, authored once in NODE_IDS order. Roles
 * move constantly, wires do not, so `link()` resolves any ordered pair to an
 * edge plus the direction to travel it.
 */
const PEER_EDGES = NODE_IDS.flatMap((a, i) =>
  NODE_IDS.slice(i + 1).map((b, j) => ({
    id: `${a}-${b}`,
    from: a,
    to: b,
    // Ring sides run straight; the five chords bow away from the centre so
    // the pentagram stays legible instead of crossing in one knot.
    curve: j === 0 || (i === 0 && j === 3) ? 0 : 0.12,
  })),
);

function link(from: Nid, to: Nid): { edgeId: string; reverse: boolean } {
  const forward = NODE_IDS.indexOf(from) < NODE_IDS.indexOf(to);
  return {
    edgeId: forward ? `${from}-${to}` : `${to}-${from}`,
    reverse: !forward,
  };
}

/* ---------------- Timing ---------------- */

/**
 * Progress/sec for each message kind — control traffic outruns client writes.
 * A vote round trip is two hops at VOTE_SPEED (~0.6s), which is most of what
 * an election costs once a timer has fired.
 */
const HB_SPEED = 3;
const VOTE_SPEED = 3.2;
const WRITE_SPEED = 2;

/* ---------------- Lesson state ---------------- */

export type Role = "leader" | "candidate" | "follower";

interface Peer {
  role: Role;
  /** Monotonic election term. Higher always wins; nobody argues with a term. */
  term: number;
  /** Who this node voted for IN `term` — one vote per node per term. */
  votedFor: Nid | null;
  /** Sim-seconds: when this node's randomized timer fires. -1 = unarmed. */
  timeoutAt: number;
  /** Grants collected this term (candidates only). */
  votes: number;
  /** Liveness as of last tick — how kills and revives are detected. */
  wasAlive: boolean;
}

interface ElectionState {
  peers: Record<Nid, Peer>;
  /** Whoever currently holds the leader role, recomputed every tick. */
  leaderId: Nid | null;
  /** Sim-seconds the current leader won its election (drives a caption gate). */
  leaderSince: number;
  /** Sim-seconds banked toward the leader's next heartbeat burst. */
  hbAcc: number;
  /** Elections that produced a leader. */
  elections: number;
  /** Candidacies started — including the ones that went nowhere. */
  attempts: number;
  /** Writes that found no leader (or a dead entry point) and bounced. */
  rejectedWrites: number;
  committedWrites: number;
  commitEma: number;
  /** Sim-seconds the cluster has spent with nobody in charge. */
  leaderlessFor: number;
}

/** What the figure draws in each node's role badge. */
export interface ElectionNodeMeta {
  role: Role;
  term: number;
  votes: number;
  needed: number;
}

const peer = (): Peer => ({
  role: "follower",
  term: 0,
  votedFor: null,
  timeoutAt: -1,
  votes: 0,
  wasAlive: true,
});

/**
 * Raft's one essential trick: every timer is drawn fresh from [T, 2T), so two
 * followers almost never expire on the same tick and split votes stay rare.
 * Every draw comes from `state.rng` — same seed, same winner, every run.
 */
function arm(state: SimState<ElectionState>, p: Peer, base: number): void {
  p.timeoutAt = state.t + base * (1 + state.rng());
}

/** Step down to follower on hearing a higher term — the rule that ends ties. */
function stepDown(
  state: SimState<ElectionState>,
  p: Peer,
  term: number,
  base: number,
): void {
  p.term = term;
  p.role = "follower";
  p.votedFor = null;
  p.votes = 0;
  arm(state, p, base);
}

const liveCount = (s: SimState<ElectionState>) =>
  NODE_IDS.filter((id) => isAlive(s, id)).length;

/** Scripted failure: take out whoever is in charge at that moment. */
function killLeader(s: SimState<ElectionState>): void {
  if (s.lesson.leaderId) killNode(s, s.lesson.leaderId);
}

export const leaderElectionSim: LessonSim<ElectionState> = {
  id: "leader-election",

  topology: {
    nodes: [
      { id: "app", kind: "client", label: "app", x: 110, y: 225 },
      ...NODE_IDS.map((id, i) => ({
        id,
        kind: "database" as const,
        label: id,
        ...ringPos(i),
        breakable: true,
      })),
    ],
    edges: [
      { id: CLIENT_EDGE, from: "app", to: CONTACT },
      ...PEER_EDGES,
    ],
  },

  packetStyles: {
    // Client writes are the primary traffic — amber, like every other request
    // in the course. (Violet is spoken for here: it's the vote wire.)
    write: { color: "var(--color-accent)" },
    // Heartbeats: constant, tiny, and informational — the demoted hue.
    heartbeat: { color: "var(--color-glow-cyan)", size: 2.5 },
    vote: { color: "var(--color-glow-violet)" },
    granted: { color: "var(--color-glow-green)" },
    // A refusal is not a failure — grey, so red keeps meaning "dead".
    denied: { color: "var(--color-fg-faint)", size: 3 },
  },

  initialNodes: Object.fromEntries(
    NODE_IDS.map((id) => [
      id,
      { meta: { role: "follower", term: 0, votes: 0, needed: MAJORITY } },
    ]),
  ),

  params: [
    {
      key: "heartbeat",
      label: "heartbeat interval",
      kind: "slider",
      min: 0.2,
      max: 1.6,
      step: 0.1,
      unit: "s",
      defaultValue: 0.5,
    },
    {
      // The window is [T, 2T): at the default 1.0s no follower can time out
      // between 0.5s heartbeats, and pushing the interval past 1.0s starts
      // stealing elections from a leader that never failed.
      key: "timeout",
      label: "election timeout",
      kind: "slider",
      min: 0.8,
      max: 3,
      step: 0.1,
      unit: "s",
      defaultValue: 1,
    },
    {
      key: "writeRate",
      label: "write rate",
      kind: "slider",
      min: 1,
      max: 8,
      step: 1,
      unit: " w/s",
      defaultValue: 3,
    },
    { key: "killLeader", label: "kill the leader", kind: "button", defaultValue: false },
  ],

  init: () => ({
    peers: Object.fromEntries(NODE_IDS.map((id) => [id, peer()])) as Record<
      Nid,
      Peer
    >,
    leaderId: null,
    leaderSince: 0,
    hbAcc: 0,
    elections: 0,
    attempts: 0,
    rejectedWrites: 0,
    committedWrites: 0,
    commitEma: 0,
    leaderlessFor: 0,
  }),

  step: (state, dt, params) => {
    const L = state.lesson;
    const hbInterval = Number(params.heartbeat);
    const base = Number(params.timeout);

    // 0. The momentary button — kill whoever is leading right now.
    if (params.killLeader === true) {
      params.killLeader = false; // consume the press
      killLeader(state);
    }

    // 1. Membership. A dead node holds no role; a restarted one comes back as
    //    a follower with a fresh timer, keeping the term it had (Raft persists
    //    it) until the first heartbeat teaches it the current one.
    for (const id of NODE_IDS) {
      const p = L.peers[id];
      const alive = isAlive(state, id);
      if (alive !== p.wasAlive) {
        p.wasAlive = alive;
        p.role = "follower";
        p.votes = 0;
        if (alive) {
          p.votedFor = null;
          arm(state, p, base);
        }
      }
      if (alive && p.timeoutAt < 0) arm(state, p, base);
    }

    const leaderId =
      NODE_IDS.find(
        (id) => L.peers[id].role === "leader" && isAlive(state, id),
      ) ?? null;
    L.leaderId = leaderId;

    // 2. Heartbeats — the leader's only job here, and the reason nobody else
    //    starts an election.
    if (leaderId) {
      L.hbAcc += dt;
      if (L.hbAcc >= hbInterval) {
        L.hbAcc = 0;
        const term = L.peers[leaderId].term;
        for (const id of NODE_IDS) {
          if (id === leaderId || !isAlive(state, id)) continue;
          const { edgeId, reverse } = link(leaderId, id);
          spawnPacket(state, edgeId, "heartbeat", {
            speed: HB_SPEED,
            reverse,
            payload: { to: id, from: leaderId, term },
          });
        }
      }
    } else {
      // Leaderless: a winner should start talking the instant it wins.
      L.hbAcc = hbInterval;
      L.leaderlessFor += dt;
    }

    // 3. Expired timers → candidacies. Everyone runs their own clock, which is
    //    why the first to expire usually wins outright.
    for (const id of NODE_IDS) {
      const p = L.peers[id];
      if (!isAlive(state, id) || p.role === "leader") continue;
      if (state.t < p.timeoutAt) continue;

      p.role = "candidate";
      p.term += 1;
      p.votedFor = id; // a candidate always votes for itself
      p.votes = 1;
      arm(state, p, base); // …and retries if this term goes nowhere
      L.attempts += 1;
      for (const other of NODE_IDS) {
        if (other === id || !isAlive(state, other)) continue;
        const { edgeId, reverse } = link(id, other);
        spawnPacket(state, edgeId, "vote", {
          speed: VOTE_SPEED,
          reverse,
          payload: { to: other, from: id, term: p.term },
        });
      }
    }

    // 4. Client writes enter at the contact node.
    const writes = shouldSpawn(state, Number(params.writeRate), dt);
    for (let i = 0; i < writes; i++) {
      spawnPacket(state, CLIENT_EDGE, "write", { speed: WRITE_SPEED });
    }

    // 5. Deliveries.
    let commitsNow = 0;
    /** Send `type` back the way `p` came. */
    const replyTo = (
      p: Packet,
      type: string,
      payload: Record<string, unknown>,
    ) => {
      spawnPacket(state, p.edgeId, type, {
        speed: VOTE_SPEED,
        reverse: !p.reverse,
        payload,
      });
    };

    for (const p of advancePackets(state, dt)) {
      const to = p.payload?.to as Nid | undefined;
      const from = p.payload?.from as Nid | undefined;
      const term = Number(p.payload?.term ?? 0);
      const target = to ? L.peers[to] : null;
      // Control traffic addressed to a node that died in flight simply
      // vanishes; a client write still has to be accounted for below.
      if (to && p.type !== "write" && !isAlive(state, to)) continue;

      if (p.type === "heartbeat" && target && from) {
        if (term >= target.term) {
          // The leader is alive and current: adopt its term, stand down if you
          // were campaigning, and — the point of the whole message — restart
          // the election timer.
          target.term = term;
          target.role = "follower";
          target.votedFor = from;
          target.votes = 0;
          arm(state, target, base);
        } else {
          // A leader the cluster has already replaced. Tell it so.
          replyTo(p, "denied", { to: from, from: to, term: target.term });
        }
      } else if (p.type === "vote" && target && from) {
        if (term > target.term) stepDown(state, target, term, base);
        const grant =
          term >= target.term &&
          (target.votedFor === null || target.votedFor === from);
        if (grant) {
          target.votedFor = from;
          arm(state, target, base); // granting also buys the candidate time
          replyTo(p, "granted", { to: from, from: to, term });
        } else {
          replyTo(p, "denied", { to: from, from: to, term: target.term });
        }
      } else if (p.type === "granted" && target) {
        // Stale grants (wrong term, or the candidate already stood down) are
        // ignored — a vote counts only for the term it was cast in.
        if (target.role !== "candidate" || target.term !== term) continue;
        target.votes += 1;
        if (target.votes >= MAJORITY) {
          target.role = "leader";
          L.elections += 1;
          L.leaderSince = state.t;
          L.hbAcc = hbInterval; // start talking immediately
        }
      } else if (p.type === "denied" && target) {
        // Somebody knows a newer term than we do: adopt it and stand down.
        if (term > target.term) stepDown(state, target, term, base);
      } else if (p.type === "write") {
        if (p.edgeId === CLIENT_EDGE) {
          // Arrived at the app's entry point.
          if (!isAlive(state, CONTACT) || !leaderId) {
            L.rejectedWrites += 1;
            bounceDrop(state, p.edgeId);
          } else if (leaderId === CONTACT) {
            commitsNow += 1;
            spawnPacket(state, p.edgeId, "response", {
              speed: WRITE_SPEED,
              reverse: true,
            });
          } else {
            // Proxy it to whoever is leading, over the peer mesh.
            const { edgeId, reverse } = link(CONTACT, leaderId);
            spawnPacket(state, edgeId, "write", {
              speed: WRITE_SPEED,
              reverse,
              payload: { to: leaderId },
            });
          }
        } else if (to && to === leaderId) {
          commitsNow += 1;
          spawnPacket(state, p.edgeId, "response", {
            speed: WRITE_SPEED,
            reverse: !p.reverse,
            payload: { to: CONTACT },
          });
        } else {
          // Leadership moved (or vanished) while the write was on the wire.
          L.rejectedWrites += 1;
          bounceDrop(state, p.edgeId, { reverse: !p.reverse });
        }
      } else if (p.type === "response" && p.edgeId !== CLIENT_EDGE) {
        // The leader's ack, relayed by the entry node back to the app.
        spawnPacket(state, CLIENT_EDGE, "response", {
          speed: WRITE_SPEED,
          reverse: true,
        });
      }
      // "response" on the client edge and faded "drop"s just complete.
    }

    // 6. Readouts.
    L.committedWrites += commitsNow;
    L.commitEma = emaRate(L.commitEma, commitsNow, dt);

    let maxTerm = 0;
    for (const id of NODE_IDS) {
      const p = L.peers[id];
      maxTerm = Math.max(maxTerm, p.term);
      const node = state.nodes[id];
      node.meta = {
        role: p.role,
        term: p.term,
        votes: p.votes,
        needed: MAJORITY,
      } satisfies ElectionNodeMeta;
      if (!isAlive(state, id)) {
        node.load = 0;
        continue;
      }
      // The leader carries the write traffic; a candidate is busy campaigning;
      // a follower's only work is answering.
      const target =
        p.role === "leader"
          ? clamp01(0.25 + L.commitEma / 12)
          : p.role === "candidate"
            ? 0.55
            : 0.12;
      node.load = approach(node.load, target, 6, dt);
    }

    state.metrics.term = maxTerm;
    state.metrics.elections = L.elections;
    // Not metered, but the honest denominator behind ELECTIONS WON: with no
    // quorum this climbs forever while `elections` never moves.
    state.metrics.attempts = L.attempts;
    state.metrics.committedWrites = L.committedWrites;
    state.metrics.rejectedWrites = L.rejectedWrites;
    state.metrics.liveNodes = liveCount(state);
    state.metrics.hasLeader = leaderId ? 1 : 0;
    state.metrics.leaderless = L.leaderlessFor;
  },

  timeline: [
    {
      at: 0.3,
      caption:
        "Cold start: five peers, no leader. Each is counting down its own randomized timer.",
    },
    {
      at: 4.5,
      when: (s) => s.lesson.leaderId !== null,
      caption:
        "Cyan = heartbeats. Every one a follower receives resets its election timer — that is the entire mechanism.",
    },
    {
      at: 9,
      caption:
        "⚙ Now stretch HEARTBEAT INTERVAL toward the election timeout — followers start timing out on a leader that is perfectly alive.",
    },
    {
      at: 12,
      caption:
        "☠ The leader is dead. Heartbeats stop; the surviving timers keep counting down.",
      apply: killLeader,
    },
    {
      // Named winner — true of the seeded run, where n2's timer expires one
      // tick ahead of n4's and both stand for term 2. The generic twin below
      // covers every run the learner has already meddled with; the gates are
      // mutually exclusive, and both close at 17 so neither can fire stale.
      at: 12.9,
      when: (s) =>
        s.t < 17 && s.lesson.leaderId === "n2" && s.lesson.leaderSince > 12,
      caption:
        "n2 timed out first — its randomized timer won the race, and 3 of 5 votes made it leader. Writes resume after two seconds of nobody in charge.",
    },
    {
      at: 12.9,
      when: (s) =>
        s.t < 17 &&
        s.lesson.leaderId !== null &&
        s.lesson.leaderId !== "n2" &&
        s.lesson.leaderSince > 12,
      caption:
        "The first timer to expire became a candidate, took 3 of 5 votes, and the writes resumed against it — a couple of seconds, start to finish.",
    },
    {
      at: 17,
      caption:
        "☠ Your turn: keep killing. How few of the five can still elect a leader?",
    },
    {
      at: 20,
      caption:
        "☠ Scripted: a second node is gone. Three of five is still a majority — the cluster barely notices.",
      apply: (s) => {
        const victim = NODE_IDS.find(
          (id) => id !== CONTACT && id !== s.lesson.leaderId && isAlive(s, id),
        );
        if (victim) killNode(s, victim);
      },
    },
    {
      at: 24,
      caption:
        "☠ Scripted: the new leader dies too, and the cluster is cut down to two live nodes.",
      apply: (s) => {
        killLeader(s);
        // Whatever the learner revived, this beat leaves exactly two standing —
        // and never the app's entry point, so the writes bounce for want of a
        // leader rather than for want of a route.
        for (const id of NODE_IDS) {
          if (liveCount(s) <= 2) break;
          if (id !== CONTACT && isAlive(s, id)) killNode(s, id);
        }
      },
    },
    {
      at: 26,
      caption:
        "Both survivors keep timing out and bumping TERM — and stalling at their own single vote. ELECTIONS WON never moves.",
    },
    {
      at: 27.5,
      caption:
        "↑ One node reboots. Three of five is a majority again — a leader inside one round, and the writes resume.",
      apply: (s) => {
        const back = NODE_IDS.find((id) => !isAlive(s, id));
        if (back) reviveNode(s, back);
      },
    },
  ],

  quiz: [
    {
      id: "le-quorum",
      at: 24.6,
      question:
        "Two nodes were already dead, and the new leader has just been killed as well. Two of the five are still running, both healthy, both able to reach each other. Can they elect a leader?",
      choices: [
        {
          id: "no",
          label:
            "No — 2 votes is not a majority of 5; the cluster stays leaderless until a node comes back",
        },
        {
          id: "yes",
          label: "Yes — 2 of the 2 survivors agreeing is unanimous",
        },
        {
          id: "maybe",
          label: "Yes, after a few rounds — the term keeps rising until one wins",
        },
      ],
      correctChoiceId: "no",
      explain:
        "A majority means a majority of the CLUSTER (3 of 5), not of whoever happens to be alive. The two survivors will keep timing out, keep incrementing the term and keep asking — TERM climbs forever, ELECTIONS never moves, and every write bounces. That rule is not pedantry: it is the only thing preventing split brain. If two survivors could elect themselves a leader, so could the other three on the far side of a network partition — two leaders, two divergent histories, one unrecoverable database. Which is why clusters are sized odd (5 tolerates 2 failures, 4 also tolerates only 1) and why a 2-node 'HA pair' is a trap: it survives zero failures, because 1 is not a majority of 2.",
    },
  ],

  meters: [
    { metricKey: "term", label: "current term", kind: "counter" },
    { metricKey: "elections", label: "elections won", kind: "counter" },
    {
      metricKey: "rejectedWrites",
      label: "writes rejected",
      kind: "counter",
      dangerAbove: 0,
    },
    {
      metricKey: "liveNodes",
      label: "live nodes",
      kind: "bar",
      max: NODE_IDS.length,
      dangerBelow: MAJORITY,
    },
  ],
};
