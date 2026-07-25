import {
  advancePackets,
  approach,
  clamp01,
  emaEvent,
  isAlive,
  killNode,
  recordSample,
  reviveNode,
  spawnPacket,
} from "@/engine/sim-helpers";
import type { LessonSim, Packet, SimState } from "@/engine/types";

/**
 * Lesson 12 — Two-Phase Commit. The rare lesson where the packet metaphor IS
 * the protocol diagram: one transaction is literally four rounds of dots.
 *
 *   PREPARE  →  coordinator asks all three participants to promise
 *   VOTE     ←  each answers YES (and locks) or NO (and aborts locally)
 *   COMMIT   →  unanimous YES ⇒ commit; a single NO vetoes everything
 *   ACK      ←  participants release their locks and confirm
 *
 * A YES voter is *bound*: it has written the change to its log and locked the
 * rows, and it may not release either until the coordinator tells it the
 * outcome. Those held locks are the lock pips under each database — and the
 * reason the failure at the heart of this lesson is so vicious.
 *
 * THE WORST MOMENT is not "the coordinator crashes". It is the crash that
 * lands in the one-tick window after the last vote arrives and before the
 * decision goes out: the outcome exists, exactly one machine knows it, and
 * that machine is gone. Every participant sits on its locks — not out of
 * caution, but because "I voted YES and heard nothing" is genuinely
 * indistinguishable from "someone else voted NO". The trap (button and
 * scripted beat alike) arms a flag; `step` springs it at that exact instant.
 */

/** The three participants, in fan-out order. */
const PARTICIPANTS = ["p1", "p2", "p3"] as const;
type ParticipantId = (typeof PARTICIPANTS)[number];

/**
 * Per-participant link, with deliberately unequal speeds. Every round of 2PC
 * completes at the pace of its SLOWEST member, and staggered packets let you
 * watch the coordinator sit on two votes waiting for the third.
 */
const LINK: Record<ParticipantId, { edge: string; speed: number }> = {
  p1: { edge: "e1", speed: 1.9 },
  p2: { edge: "e2", speed: 1.6 },
  p3: { edge: "e3", speed: 1.35 },
};
/** Which participant an edge belongs to — packets carry no sender field. */
const SENDER: Record<string, ParticipantId> = { e1: "p1", e2: "p2", e3: "p3" };

/**
 * Concurrency ceiling, and the number of lock slots drawn under each database.
 * It is also the packet budget: at most MAX_ACTIVE transactions × 3 in-flight
 * packets (one round each) = 12, comfortably under the 128 pool at any rate.
 */
const MAX_ACTIVE = 4;
/** How long a crashed coordinator stays down before it recovers and replays. */
const BLOCK_SECONDS = 6;
/** Latency EMA blend per completed transaction (<1 ⇒ averages, never latches). */
const LAT_SMOOTH = 0.3;
/** Sparkline cadence: 10 samples/sec ⇒ the 80-sample window holds ~8s. */
const SAMPLE_INTERVAL = 0.1;

type Phase =
  /** Prepares are out; waiting for the vote of every participant. */
  | "voting"
  /** Every vote is in — and the coordinator died before announcing it. */
  | "blocked"
  /** The decision is out; waiting for the acks. */
  | "deciding";

interface Txn {
  id: number;
  phase: Phase;
  startedAt: number;
  /** Participants whose vote reached a live coordinator (distinct). */
  votedBy: ParticipantId[];
  /** How many of those were NO. One is enough to veto. */
  noVotes: number;
  /** Participants currently frozen holding a lock for this transaction. */
  holders: ParticipantId[];
  /** Participants whose decision-ack reached a live coordinator (distinct). */
  ackedBy: ParticipantId[];
  decision: "commit" | "abort" | null;
  /**
   * Sim-seconds the FIRST vote came home: one machine's round trip, measured
   * on the same wire as everything else. The single-node write this protocol
   * is being compared against costs exactly this.
   */
  firstVoteAt: number;
  /** The transaction the worst-moment trap has picked out (see `armKill`). */
  doomed: boolean;
}

interface TPCState {
  txns: Txn[];
  /** Transactions waiting for a free slot — or for a coordinator at all. */
  backlog: number;
  nextTxnId: number;
  /** Locks held per participant. */
  locks: Record<ParticipantId, number>;
  committed: number;
  aborted: number;
  /** Trap armed: kill the coordinator the instant its victim's votes are in. */
  armKill: boolean;
  /** The victim's id — 0 while the trap is armed but has not picked one yet. */
  armTxnId: number;
  /** Fractional arrival credit carried between ticks. */
  arrivalAcc: number;
  /** Sim-seconds the coordinator comes back (0 = nothing scheduled). */
  reviveAt: number;
  /** Sim-seconds of the last worst-moment death (0 = never). */
  deathAt: number;
  /** Dead→alive transitions: each one replays the log. */
  recoveries: number;
  /** Health edge detection for the replay. */
  coordWasDead: boolean;
  /** Mean end-to-end transaction latency, sim-seconds. */
  latencyEma: number;
  /** Mean single-round-trip latency, sim-seconds — the 1-node reference. */
  refEma: number;
  sampleAcc: number;
}

/* ---------------------------------------------------------------------------
   Protocol verbs. Each one is a round: three packets out, three packets back.
--------------------------------------------------------------------------- */

/** Resolve the transaction a packet belongs to (it may already be finished). */
function txnOf(state: SimState<TPCState>, pkt: Packet): Txn | undefined {
  const id = pkt.payload?.txn;
  return typeof id === "number"
    ? state.lesson.txns.find((t) => t.id === id)
    : undefined;
}

/** Round 1 — PREPARE fans out. Nothing is committed anywhere yet. */
function startTxn(state: SimState<TPCState>): void {
  const L = state.lesson;
  const txn: Txn = {
    id: L.nextTxnId++,
    phase: "voting",
    startedAt: state.t,
    votedBy: [],
    noVotes: 0,
    holders: [],
    ackedBy: [],
    decision: null,
    firstVoteAt: 0,
    // An armed trap claims the next transaction to start, so the death always
    // lands one full round trip after the warning — and always on a
    // transaction the learner watched begin.
    doomed: L.armKill && L.armTxnId === 0,
  };
  if (txn.doomed) L.armTxnId = txn.id;
  L.txns.push(txn);
  for (const p of PARTICIPANTS) {
    spawnPacket(state, LINK[p].edge, "prepare", {
      speed: LINK[p].speed,
      payload: { txn: txn.id },
    });
  }
}

/** Round 3 — the decision fans out. Resending it is safe: acks are per-sender. */
function sendDecision(state: SimState<TPCState>, txn: Txn): void {
  txn.phase = "deciding";
  const type = txn.decision === "abort" ? "abort" : "commit";
  for (const p of PARTICIPANTS) {
    spawnPacket(state, LINK[p].edge, type, {
      speed: LINK[p].speed,
      payload: { txn: txn.id },
    });
  }
}

/** All acks home: bank the outcome, the latency and the coordination tax. */
function completeTxn(state: SimState<TPCState>, txn: Txn): void {
  const L = state.lesson;
  // Belt and braces: a duplicate decision round could leave a holder behind,
  // and a leaked lock would silently starve every later transaction.
  for (const p of txn.holders) L.locks[p] = Math.max(0, L.locks[p] - 1);
  txn.holders = [];

  const total = state.t - txn.startedAt;
  L.latencyEma =
    L.latencyEma === 0 ? total : emaEvent(L.latencyEma, total, LAT_SMOOTH);
  if (txn.firstVoteAt > 0) {
    const oneHop = txn.firstVoteAt - txn.startedAt;
    L.refEma =
      L.refEma === 0 ? oneHop : emaEvent(L.refEma, oneHop, LAT_SMOOTH);
  }

  if (txn.decision === "commit") L.committed += 1;
  else L.aborted += 1;
  L.txns = L.txns.filter((t) => t !== txn);
}

/**
 * Timeline gate: is a round of this kind actually on the wire? The captions
 * name what the learner is looking at, so each one waits for its own packets
 * rather than trusting the clock to line up with the drumbeat.
 */
function inFlight(state: SimState<TPCState>, ...types: string[]): boolean {
  return state.packets.some((p) => types.includes(p.type));
}

/** Arm the trap. The kill itself happens in `step`, at the fragile instant. */
function armWorstMoment(state: SimState<TPCState>): void {
  const L = state.lesson;
  if (L.armKill || !isAlive(state, "coord")) return;
  L.armKill = true;
  L.armTxnId = 0;
  // A previous arm that lapsed (the learner killed the coordinator by hand
  // before the trap could spring) must not leave a stale victim behind.
  for (const txn of L.txns) txn.doomed = false;
  // Hand the trap a victim rather than waiting on the next arrival: the beat
  // is about the moment, not about how long the moment takes to show up.
  L.backlog += 1;
}

export const twoPhaseCommitSim: LessonSim<TPCState> = {
  id: "two-phase-commit",

  topology: {
    nodes: [
      {
        id: "coord",
        kind: "server",
        label: "coordinator",
        x: 210,
        y: 225,
        breakable: true,
      },
      { id: "p1", kind: "database", label: "db-a", x: 620, y: 85 },
      { id: "p2", kind: "database", label: "db-b", x: 620, y: 225 },
      { id: "p3", kind: "database", label: "db-c", x: 620, y: 365 },
    ],
    edges: [
      { id: "e1", from: "coord", to: "p1" },
      { id: "e2", from: "coord", to: "p2" },
      { id: "e3", from: "coord", to: "p3" },
    ],
  },

  /**
   * Four rounds need four colors that never get confused with each other:
   * amber asks, green agrees, red refuses, violet is the durable write, orange
   * is the warning-hued undo, cyan is the closing formality.
   */
  packetStyles: {
    prepare: { color: "var(--color-accent)", size: 4 },
    "vote-yes": { color: "var(--color-glow-green)", size: 3.5 },
    "vote-no": { color: "var(--color-glow-red)", size: 4.5 },
    commit: { color: "var(--color-glow-violet)", size: 4 },
    abort: { color: "var(--color-glow-orange)", size: 4 },
    ack: { color: "var(--color-glow-cyan)", size: 3 },
  },

  params: [
    {
      key: "rate",
      label: "transaction rate",
      kind: "slider",
      min: 0.2,
      max: 2,
      step: 0.2,
      unit: " txn/s",
      defaultValue: 0.4,
    },
    {
      key: "failRate",
      label: "participant abort rate",
      kind: "slider",
      min: 0,
      max: 40,
      step: 5,
      unit: "%",
      defaultValue: 10,
    },
    {
      key: "killWorst",
      label: "kill at the worst moment",
      kind: "button",
      defaultValue: false,
    },
  ],

  init: () => ({
    txns: [],
    backlog: 0,
    nextTxnId: 1,
    locks: { p1: 0, p2: 0, p3: 0 },
    committed: 0,
    aborted: 0,
    armKill: false,
    armTxnId: 0,
    arrivalAcc: 0,
    reviveAt: 0,
    deathAt: 0,
    recoveries: 0,
    coordWasDead: false,
    latencyEma: 0,
    refEma: 0,
    sampleAcc: 0,
  }),

  step: (state, dt, params) => {
    const L = state.lesson;
    const noRate = Number(params.failRate) / 100;

    // 0. Momentary button — arm only; the kill has to wait for the moment.
    if (params.killWorst === true) {
      params.killWorst = false; // consume the press
      armWorstMoment(state);
    }

    // 1. Scheduled recovery (the learner's own click revives it too, and the
    //    replay below keys off the health edge either way).
    if (L.reviveAt > 0 && state.t >= L.reviveAt) {
      reviveNode(state, "coord");
      L.reviveAt = 0;
    }
    let coordAlive = isAlive(state, "coord");
    // A trap only applies to a living coordinator: if the learner kills it by
    // hand first, the arm lapses rather than lying in wait for the revival.
    if (!coordAlive) {
      L.armKill = false;
      L.armTxnId = 0;
    }

    // 2. Back from the dead: replay the log. Anything with a complete,
    //    unanimous vote set commits — the decision was already made, it just
    //    never got out. Everything else is PRESUMED ABORT: with votes missing
    //    the coordinator has no record of a promise, so it takes the safe
    //    outcome. Either way the frozen participants finally hear something.
    if (coordAlive && L.coordWasDead) {
      L.recoveries += 1;
      for (const txn of L.txns) {
        txn.decision =
          txn.votedBy.length >= PARTICIPANTS.length && txn.noVotes === 0
            ? "commit"
            : "abort";
        sendDecision(state, txn);
      }
    }
    L.coordWasDead = !coordAlive;

    // 3. Transactions arrive at the coordinator, on a metronome rather than a
    //    Poisson draw. Arrival *statistics* are another lesson's subject; here
    //    the subject is the shape of one transaction, and a steady drumbeat
    //    both keeps a worked example on the stage at all times and spends no
    //    RNG — every draw this lesson makes is a participant's vote.
    L.arrivalAcc += Number(params.rate) * dt;
    while (L.arrivalAcc >= 1) {
      L.arrivalAcc -= 1;
      L.backlog += 1;
    }

    // 4. …and start only if it is alive and has a free slot. A slot is
    //    effectively a lock reservation on every participant, so this is where
    //    lock contention turns into a visible queue: raise the rate, or freeze
    //    the locks, and the backlog chip climbs.
    while (coordAlive && L.backlog > 0 && L.txns.length < MAX_ACTIVE) {
      L.backlog -= 1;
      startTxn(state);
    }

    // 5. Arrivals — the protocol itself, one round per packet type.
    for (const pkt of advancePackets(state, dt)) {
      const who = SENDER[pkt.edgeId];
      const txn = txnOf(state, pkt);

      if (pkt.type === "prepare") {
        // Round 2 at the participant. The draw happens unconditionally so RNG
        // consumption never depends on which branch a transaction took.
        // The trap's victim votes YES regardless: the failure being staged is
        // specifically "unanimous YES, then the coordinator vanishes", and a
        // stray NO would abort the transaction before the moment arrived.
        const roll = state.rng();
        const yes = txn?.doomed === true || !(roll < noRate);
        // A YES voter is now bound: log written, rows locked, no way back
        // until the decision lands. A NO voter aborts locally and locks
        // nothing — that asymmetry is why aborts are cheap and commits are
        // not. A straggler prepare for an already-resolved transaction (one
        // that outlived a crash) votes but never locks.
        if (yes && txn && txn.phase === "voting") {
          L.locks[who] += 1;
          txn.holders.push(who);
        }
        spawnPacket(state, pkt.edgeId, yes ? "vote-yes" : "vote-no", {
          speed: LINK[who].speed,
          reverse: true,
          payload: { txn: pkt.payload?.txn },
        });
        continue;
      }

      if (pkt.type === "vote-yes" || pkt.type === "vote-no") {
        // Home at the coordinator — if there still is one. A vote that lands
        // on a corpse is simply gone, and its transaction stays stuck.
        if (!coordAlive || !txn || txn.phase !== "voting") continue;
        if (txn.votedBy.includes(who)) continue;
        txn.votedBy.push(who);
        if (pkt.type === "vote-no") txn.noVotes += 1;
        if (txn.firstVoteAt === 0) txn.firstVoteAt = state.t;
        if (txn.votedBy.length < PARTICIPANTS.length) continue;

        // THE WORST MOMENT. Every vote is in, the outcome is decided, and not
        // one participant has been told. This is the single tick where losing
        // the coordinator freezes the whole group.
        if (L.armKill && txn.doomed) {
          L.armKill = false;
          L.armTxnId = 0;
          L.deathAt = state.t;
          L.reviveAt = state.t + BLOCK_SECONDS;
          txn.phase = "blocked";
          killNode(state, "coord");
          coordAlive = false; // later arrivals this tick meet the corpse too
          continue;
        }

        // Round 3. Unanimity or nothing: one NO vetoes the transaction.
        txn.decision = txn.noVotes === 0 ? "commit" : "abort";
        sendDecision(state, txn);
        continue;
      }

      if (pkt.type === "commit" || pkt.type === "abort") {
        // The participant finally learns the outcome and releases its lock.
        if (txn) {
          const held = txn.holders.indexOf(who);
          if (held >= 0) {
            txn.holders.splice(held, 1);
            L.locks[who] = Math.max(0, L.locks[who] - 1);
          }
        }
        spawnPacket(state, pkt.edgeId, "ack", {
          speed: LINK[who].speed,
          reverse: true,
          payload: { txn: pkt.payload?.txn },
        });
        continue;
      }

      if (pkt.type === "ack") {
        if (!coordAlive || !txn || txn.phase !== "deciding") continue;
        if (!txn.ackedBy.includes(who)) txn.ackedBy.push(who);
        if (txn.ackedBy.length >= PARTICIPANTS.length) completeTxn(state, txn);
      }
    }

    // 6. Readouts.
    const coord = state.nodes.coord;
    coord.queueDepth = L.backlog;
    coord.load = coordAlive
      ? approach(coord.load, clamp01(L.txns.length / MAX_ACTIVE), 6, dt)
      : 0;

    for (const p of PARTICIPANTS) {
      const node = state.nodes[p];
      const held = L.locks[p];
      const meta = (node.meta ??= {});
      meta.locks = held;
      meta.slots = MAX_ACTIVE;
      node.load = approach(node.load, clamp01(held / MAX_ACTIVE), 6, dt);
      // Frozen: holding locks with nobody left to tell it what to do.
      node.health = !coordAlive && held > 0 ? "degraded" : "healthy";
    }

    L.sampleAcc += dt;
    if (L.sampleAcc >= SAMPLE_INTERVAL) {
      L.sampleAcc -= SAMPLE_INTERVAL;
      recordSample(state, "latency", L.latencyEma * 1000);
    }

    state.metrics.committed = L.committed;
    state.metrics.aborted = L.aborted;
    // Every in-flight transaction is stuck while the coordinator is gone.
    state.metrics.blocked = coordAlive ? 0 : L.txns.length;
    state.metrics.latency = L.latencyEma * 1000;
    // Two round trips at the slowest participant's pace, over one round trip
    // to one machine: what atomicity across three databases actually costs.
    state.metrics.tax = L.refEma > 0 ? L.latencyEma / L.refEma : 0;
    state.metrics.coordDown = coordAlive ? 0 : 1;
  },

  timeline: [
    {
      at: 0.5,
      when: (s) => inFlight(s, "prepare"),
      caption:
        "Round 1 — PREPARE fans out. The coordinator is asking, not telling: can you promise to commit?",
    },
    {
      at: 4.5,
      when: (s) => inFlight(s, "vote-yes", "vote-no"),
      caption:
        "Round 2 — the votes come home, green for YES. The coordinator waits for the slowest participant; every round does.",
    },
    {
      at: 8.5,
      when: (s) => inFlight(s, "commit", "abort"),
      caption:
        "Rounds 3 and 4 — violet COMMIT out, cyan ACK back. Two full round trips to write one row.",
    },
    {
      at: 11.5,
      when: (s) => s.lesson.locks.p1 + s.lesson.locks.p2 + s.lesson.locks.p3 > 0,
      caption:
        "The pips under each database are LOCKS. A YES voter is frozen holding them until the decision lands.",
    },
    {
      at: 14,
      caption:
        "Push the sliders: one NO vote vetoes the whole transaction, and a faster rate queues new work behind held locks.",
    },
    {
      at: 16,
      // Waits for a coordinator worth killing: a learner who is already
      // holding it dead by hand gets this beat when they let it back up.
      when: (s) => isAlive(s, "coord"),
      caption:
        "⚡ The coordinator is about to die at the worst possible moment.",
      apply: armWorstMoment,
    },
    // Ungated by time: fires at whichever death comes first — the scripted one
    // or the learner's own press of the button.
    {
      at: 0,
      when: (s) => s.lesson.deathAt > 0,
      caption:
        "☠ Dead — after every vote arrived, before a single participant was told. Three databases, frozen on their locks.",
    },
    {
      at: 0,
      when: (s) => s.lesson.recoveries > 0,
      caption:
        "The coordinator is back — it replays its log, sends the decision it never got out, and the locks release.",
    },
    {
      at: 28,
      caption:
        "Your turn: press KILL AT THE WORST MOMENT and watch the freeze again — or kill the coordinator by hand and see how long they wait.",
    },
  ],

  quiz: [
    {
      // Ungated, and safe to be: arrivals are a metronome and the trap always
      // claims the transaction that starts right after the t=16 warning, so
      // the death lands at t=17.57 on every seed and the window runs to
      // t=23.57. This fires 0.93s in, with a blocked transaction holding a
      // lock on all three databases — verified headlessly across seeds.
      id: "tpc-blocked",
      at: 18.5,
      question:
        "The coordinator died after every participant voted YES. Can the participants just commit?",
      choices: [
        {
          id: "block",
          label:
            "No — no participant can know all the votes were YES, so they block holding their locks",
        },
        {
          id: "commit",
          label: "Yes — each one voted YES, so the outcome is already decided",
        },
        {
          id: "timeout",
          label: "Yes, after a timeout — a majority of YES votes is enough",
        },
      ],
      correctChoiceId: "block",
      explain:
        "Each participant knows exactly one vote: its own. From db-a's seat, 'I voted YES and heard nothing' is indistinguishable from 'db-c voted NO and the ABORT never reached me' — and guessing wrong means half the databases commit while half abort, which is precisely the split outcome 2PC exists to prevent. So they wait, holding row locks, and every transaction that needs those rows waits behind them. That is the blocking window, and it is why 2PC is feared: a coordinator crash between the last vote and the decision freezes the group until it comes back and replays its log. Consensus protocols (Raft, Paxos) close the window by replicating the decision log itself, so a new coordinator can be elected and simply read the outcome; sagas dodge it by giving up atomicity and compensating afterwards.",
    },
  ],

  meters: [
    { metricKey: "committed", label: "committed", kind: "counter" },
    { metricKey: "aborted", label: "aborted", kind: "counter" },
    {
      metricKey: "blocked",
      label: "blocked txns",
      kind: "counter",
      dangerAbove: 0,
    },
    {
      metricKey: "latency",
      label: "2PC latency",
      kind: "sparkline",
      unit: " ms",
      decimals: 0,
    },
    {
      // vs. the same write on one machine: one round trip, no votes, no locks.
      metricKey: "tax",
      label: "coordination tax",
      kind: "counter",
      unit: "×",
      decimals: 1,
    },
  ],
};
