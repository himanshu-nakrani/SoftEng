import {
  advancePackets,
  bounceDrop,
  emaRate,
  severEdge,
  shouldSpawn,
  spawnPacket,
} from "@/engine/sim-helpers";
import type { LessonSim } from "@/engine/types";

/**
 * Lesson 10 — The CAP Theorem. Two replicas, clients on each coast, a
 * replication link between them, and a scripted outage that cuts it: from
 * that moment the mode switch decides which promise survives — consistency
 * (CP: the minority side refuses writes) or availability (AP: both sides
 * accept and diverge). The scripted heal collects on the AP bill:
 * last-write-wins keeps one replica's copy and deletes every write the other
 * one accepted while it was cut off.
 *
 * The *partition* is scripted because that is the theorem's whole point —
 * an outage is not a setting anybody opts into (the toggle stays live for
 * re-runs, and the timeline hands control back after the heal). The
 * *response* is never scripted: the mode select is the learner's every tick.
 */

/** Scripted outage: opens at SPLIT_AT, closes SPLIT_SECONDS later. */
const SPLIT_AT = 8;
const SPLIT_SECONDS = 10;
const HEAL_AT = SPLIT_AT + SPLIT_SECONDS;
/** The link is forced back up this long — enough to always finish reconciling. */
const HEAL_HOLD = 4;
/** Reconciliation always takes this long, however far the replicas drifted. */
const HEAL_SECONDS = 2;

interface CAPState {
  vWest: number;
  vEast: number;
  /** Writes applied on exactly one side while partitioned (AP divergence). */
  diverged: number;
  /** …split by side, because reconciliation only discards the loser's. */
  divWest: number;
  divEast: number;
  rejectedTotal: number;
  acceptEma: number;
  /** Reconciliation in progress: the link is back, the versions disagree. */
  healing: boolean;
  /** Writes last-write-wins is about to delete — banked when the heal starts. */
  pendingLoss: number;
  /** Divergence drained per second, so a heal always takes HEAL_SECONDS. */
  healRate: number;
  /** Writes acknowledged to a client and then thrown away by a heal. */
  lostWrites: number;
  /** Scripted outage window (set by the timeline). */
  scriptSplitUntil: number;
  /** …and the window where the link is forced back up to reconcile. */
  scriptHealUntil: number;
}

export const capTheoremSim: LessonSim<CAPState> = {
  id: "cap-theorem",

  topology: {
    nodes: [
      { id: "cw", kind: "client", label: "us-west", x: 120, y: 130 },
      { id: "rw", kind: "database", label: "db-west", x: 330, y: 130 },
      { id: "re", kind: "database", label: "db-east", x: 530, y: 320 },
      { id: "ce", kind: "client", label: "us-east", x: 715, y: 320 },
    ],
    edges: [
      { id: "in-w", from: "cw", to: "rw" },
      { id: "in-e", from: "ce", to: "re" },
      { id: "sync", from: "rw", to: "re", curve: -0.14 },
    ],
  },

  params: [
    {
      key: "partition",
      label: "network partition",
      kind: "toggle",
      defaultValue: false,
    },
    {
      key: "mode",
      label: "during partition",
      kind: "select",
      options: [
        { value: "ap", label: "AP — accept & diverge" },
        { value: "cp", label: "CP — refuse writes" },
      ],
      // AP by default so the scripted outage tells the whole story unaided:
      // accept everything, diverge, then pay at the heal. CP is the deliberate
      // alternative the learner picks — and the sim never overrides the pick.
      defaultValue: "ap",
    },
    {
      key: "rate",
      label: "write rate / side",
      kind: "slider",
      min: 1,
      max: 8,
      step: 1,
      unit: " w/s",
      defaultValue: 3,
    },
  ],

  init: () => ({
    vWest: 0,
    vEast: 0,
    diverged: 0,
    divWest: 0,
    divEast: 0,
    rejectedTotal: 0,
    acceptEma: 0,
    healing: false,
    pendingLoss: 0,
    healRate: 0,
    lostWrites: 0,
    scriptSplitUntil: 0,
    scriptHealUntil: 0,
  }),

  step: (state, dt, params) => {
    const L = state.lesson;
    // Scripted outage, then a scripted heal window that outranks the toggle
    // just long enough for reconciliation to finish. After that the toggle
    // is the only thing holding the link down.
    const scriptedSplit = state.t < L.scriptSplitUntil;
    const scriptedHeal = !scriptedSplit && state.t < L.scriptHealUntil;
    const partitioned =
      scriptedSplit || (!scriptedHeal && params.partition === true);
    const cp = params.mode === "cp";

    // Heal moment: the link is back and the replicas disagree. Last-write-wins
    // keeps the higher version, which means the other side's writes — every
    // one of them acknowledged to a real client — are deleted.
    if (!partitioned && L.diverged > 0) {
      if (!L.healing) {
        L.healing = true;
        // Bank the bill before reconciliation hides who lost. Ties go to west,
        // the same arbitrary tiebreak a wall-clock timestamp would make.
        L.pendingLoss = L.vWest >= L.vEast ? L.divEast : L.divWest;
        L.healRate = L.diverged / HEAL_SECONDS;
      }
      L.diverged = Math.max(0, L.diverged - L.healRate * dt);
      if (L.diverged === 0) {
        const merged = Math.max(L.vWest, L.vEast);
        L.vWest = merged;
        L.vEast = merged;
        L.lostWrites += L.pendingLoss;
        L.pendingLoss = 0;
        L.divWest = 0;
        L.divEast = 0;
        L.healing = false;
      }
    }

    // Writes arrive on both coasts (independent draws — the coasts don't sync).
    const westSpawns = shouldSpawn(state, Number(params.rate), dt);
    for (let i = 0; i < westSpawns; i++) {
      spawnPacket(state, "in-w", "write", { speed: 1.6 });
    }
    const eastSpawns = shouldSpawn(state, Number(params.rate), dt);
    for (let i = 0; i < eastSpawns; i++) {
      spawnPacket(state, "in-e", "write", { speed: 1.6 });
    }

    let acceptedNow = 0;
    for (const p of advancePackets(state, dt)) {
      if (p.type === "write" && (p.edgeId === "in-w" || p.edgeId === "in-e")) {
        const west = p.edgeId === "in-w";
        if (partitioned && cp && !west) {
          // CP: the minority (east) side refuses — consistency over availability.
          L.rejectedTotal += 1;
          bounceDrop(state, p.edgeId, { type: "limited", speed: 1.9 });
          continue;
        }
        acceptedNow += 1;
        if (west) L.vWest += 1;
        else L.vEast += 1;
        if (partitioned) {
          // Applied on one side only — and remembered per side, since a heal
          // discards exactly the losing side's share.
          L.diverged += 1;
          if (west) L.divWest += 1;
          else L.divEast += 1;
        } else {
          // Replicate across; direction encoded in reverse flag.
          spawnPacket(state, "sync", "replication", {
            speed: 1.1,
            size: 3,
            reverse: !west,
            payload: { west },
          });
        }
        spawnPacket(state, p.edgeId, "response", { speed: 1.6, reverse: true });
      } else if (p.type === "replication" && !L.healing) {
        // Applied on the far side — but not mid-heal: a replication landing
        // during reconciliation would quietly converge the version chips
        // before the bill is paid, hiding the whole point.
        if (p.payload?.west === true) L.vEast = Math.max(L.vEast, L.vWest);
        else L.vWest = Math.max(L.vWest, L.vEast);
      }
      // Severed sync packets (now "drop") just fade out on arrival.
    }

    // While partitioned, nothing crosses the divide: cut the link and let
    // whatever was mid-flight die where the break caught it.
    if (partitioned) {
      severEdge(state, "sync", "drop");
      // A partition re-opening mid-heal abandons that reconciliation; the next
      // one re-banks the bill from scratch.
      L.healing = false;
      L.pendingLoss = 0;
    }

    // Readouts.
    L.acceptEma = emaRate(L.acceptEma, acceptedNow, dt);
    const maxRate = Number(params.rate) * 2;
    state.nodes.rw.queueDepth = L.vWest;
    state.nodes.re.queueDepth = L.vEast;
    state.nodes.rw.health = "healthy";
    state.nodes.re.health = partitioned && cp ? "degraded" : "healthy";
    state.metrics.diverged = L.diverged;
    state.metrics.availability = Math.min(
      (L.acceptEma / Math.max(maxRate, 0.01)) * 100,
      100,
    );
    state.metrics.rejected = L.rejectedTotal;
    state.metrics.lostWrites = L.lostWrites;
    state.metrics.partitioned = partitioned ? 1 : 0;
  },

  workbench: {
    experiment: {
      id: "watch-a-partition-choice",
      title: "Watch a partition force a choice",
      prompt:
        "Start synchronized writes, then follow the split to see why the system must either reject work or accept divergence.",
      actionLabel: "Start replicated writes",
      focusId: "synchronized-writes",
      action: { kind: "play" },
    },
    focuses: [
      {
        id: "synchronized-writes",
        label: "Replication makes one dataset while the link is healthy",
        phase: "baseline",
        at: 2,
        nodes: ["cw", "rw", "re", "ce"],
        edges: ["in-w", "in-e", "sync"],
        metrics: ["availability", "diverged", "rejected"],
        summary:
          "With the inter-region link healthy, writes accepted on either coast are replicated across the sync path so both databases converge on the same state.",
        nextAction: "Keep the sync path visible as the partition removes it.",
      },
      {
        id: "partition-choice",
        label: "A partition removes the ability to know the other side",
        phase: "change",
        at: SPLIT_AT,
        nodes: ["rw", "re"],
        edges: ["sync"],
        metrics: ["availability", "diverged", "rejected"],
        summary:
          "When the link is partitioned, neither replica can learn the other side’s new writes, so the remaining choice is between availability and immediate consistency.",
        nextAction: "Switch between AP and CP while the link is down and compare accepted versus rejected writes.",
        trigger: { kind: "param-change", id: "mode" },
      },
      {
        id: "ap-divergence",
        label: "AP accepts writes by accumulating disagreement",
        phase: "impact",
        at: 13.5,
        nodes: ["cw", "rw", "re", "ce"],
        edges: ["in-w", "in-e"],
        metrics: ["availability", "diverged", "rejected"],
        summary:
          "In AP mode both coasts accept writes during the split, preserving write availability while building an explicit set of diverged writes that must later be reconciled.",
        nextAction: "Turn the partition on yourself, then compare AP divergence with CP rejections at the same write rate.",
        trigger: { kind: "param-change", id: "partition" },
      },
      {
        id: "reconciliation-bill",
        label: "Healing reveals the conflict-resolution bill",
        phase: "resolution",
        at: HEAL_AT,
        nodes: ["rw", "re"],
        edges: ["sync"],
        metrics: ["diverged", "lostWrites", "availability"],
        summary:
          "When the link returns, the replicas must become one state again; the modeled last-write-wins rule resolves that disagreement by discarding the losing side’s accepted writes.",
        nextAction: "Replay the split in CP mode and contrast immediate rejected writes with later lost writes.",
      },
    ],
  },

  timeline: [
    {
      at: 2,
      caption:
        "Two coasts, one dataset. Violet packets keep db-west and db-east in sync.",
    },
    {
      at: SPLIT_AT,
      caption:
        "⚡ A fiber cut takes the link down. Nobody chose this — the only choice left is what to do about it.",
      apply: (s) => {
        s.lesson.scriptSplitUntil = s.t + SPLIT_SECONDS;
        s.lesson.scriptHealUntil = s.t + SPLIT_SECONDS + HEAL_HOLD;
      },
    },
    {
      at: 13.5,
      caption:
        "AP: both sides keep accepting, so the versions drift apart. DIVERGED WRITES is the unpaid bill.",
    },
    {
      at: HEAL_AT,
      caption:
        "The link is back. Two replicas, two different versions — and only one of them survives.",
    },
    {
      at: 23,
      caption:
        "Your turn: cut the link yourself, and try CP — db-east refuses writes instead of losing them later.",
    },
  ],

  quiz: [
    {
      id: "cap-choice",
      at: 12,
      question:
        "The network is split and writes keep arriving on BOTH sides. Which of these is impossible — not hard, impossible?",
      choices: [
        {
          id: "both",
          label: "Accepting every write AND keeping both replicas consistent",
        },
        {
          id: "cp",
          label: "Refusing one side's writes to stay consistent",
        },
        {
          id: "ap",
          label: "Accepting both sides and reconciling later",
        },
      ],
      correctChoiceId: "both",
      explain:
        "With the link down, information physically cannot cross the partition. Any write accepted on one side is invisible to the other — so 'available everywhere AND consistent everywhere' isn't an engineering challenge, it's a contradiction. CP and AP are both real systems; CA-under-partition is a fiction.",
    },
    {
      id: "cap-heal-loss",
      at: HEAL_AT + 0.5,
      // Gated on a reconciliation that actually has something to lose: a
      // learner who sat out the split in CP never diverged, so this beat waits
      // for the AP split they eventually run instead of asking about nothing.
      when: (s) => s.lesson.pendingLoss > 0,
      question:
        "The partition is healing. The two replicas hold different versions and last-write-wins keeps the higher one. What happens to the writes the losing replica accepted while the link was down?",
      choices: [
        {
          id: "discarded",
          label: "They're silently discarded — no error, no notification",
        },
        {
          id: "replayed",
          label: "They're replayed onto the winner, so every write survives",
        },
        {
          id: "queued",
          label: "They're queued and applied after the winner's writes",
        },
      ],
      correctChoiceId: "discarded",
      explain:
        "Watch LOST WRITES jump. AP bought availability during the split; this is the bill. Last-write-wins overwrites the losing replica wholesale, so every write it accepted — each one already acknowledged to a client with a cheerful 200 — vanishes without a trace. Conflict resolution is where AP systems earn their keep: LWW is the cheapest and the lossiest, while vector clocks detect the conflict, CRDTs merge it (a counter that adds both sides' increments instead of picking one), and app-level merges decide it with logic only you can write.",
    },
  ],

  meters: [
    {
      metricKey: "availability",
      label: "write availability",
      kind: "gauge",
      max: 100,
      unit: "%",
      dangerBelow: 60,
    },
    {
      metricKey: "diverged",
      label: "diverged writes",
      kind: "counter",
      decimals: 0,
      dangerAbove: 0,
    },
    {
      metricKey: "rejected",
      label: "rejected writes",
      kind: "counter",
      dangerAbove: 0,
    },
    {
      metricKey: "lostWrites",
      label: "lost writes",
      kind: "counter",
      decimals: 0,
      dangerAbove: 0,
    },
  ],
};
