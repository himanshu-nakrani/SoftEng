import {
  advancePackets,
  bounceDrop,
  emaRate,
  shouldSpawn,
  spawnPacket,
} from "@/engine/sim-helpers";
import type { LessonSim } from "@/engine/types";

/**
 * Lesson 10 — The CAP Theorem. Two replicas, clients on each coast, a
 * PARTITION toggle that severs replication, and a CP/AP mode switch that
 * decides which promise survives: consistency (west keeps writing, east
 * rejects) or availability (both write, divergence climbs).
 */

interface CAPState {
  vWest: number;
  vEast: number;
  /** Writes applied on exactly one side while partitioned (AP divergence). */
  diverged: number;
  rejectedTotal: number;
  acceptEma: number;
  /** Replication packets in the buffer when the partition healed. */
  healing: boolean;
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
        { value: "cp", label: "CP — refuse writes" },
        { value: "ap", label: "AP — accept & diverge" },
      ],
      defaultValue: "cp",
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
    rejectedTotal: 0,
    acceptEma: 0,
    healing: false,
  }),

  step: (state, dt, params) => {
    const L = state.lesson;
    const partitioned = params.partition === true;
    const cp = params.mode === "cp";

    // Heal moment: divergence resolves (last-write-wins — someone loses).
    if (!partitioned && L.diverged > 0) {
      L.diverged = Math.max(0, L.diverged - 12 * dt); // visible resolution
      L.healing = true;
      if (L.diverged === 0) {
        const merged = Math.max(L.vWest, L.vEast);
        L.vWest = merged;
        L.vEast = merged;
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
          L.diverged += 1; // applied on one side only
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
      } else if (p.type === "replication") {
        // Applied on the far side.
        if (p.payload?.west === true) L.vEast = Math.max(L.vEast, L.vWest);
        else L.vWest = Math.max(L.vWest, L.vEast);
      }
    }

    // While partitioned, nothing crosses the divide (drop in-flight sync).
    if (partitioned) {
      const crossing = state.packets.filter((p) => p.edgeId === "sync");
      if (crossing.length > 0) {
        state.packets = state.packets.filter((p) => p.edgeId !== "sync");
        for (const p of crossing) {
          // Not a bounce: a severed link drops the packet where it was headed.
          bounceDrop(state, "sync", { speed: 1.6, reverse: p.reverse });
        }
      }
    }

    // Readouts.
    L.acceptEma = emaRate(L.acceptEma, acceptedNow, dt);
    const maxRate = Number(params.rate) * 2;
    state.nodes.rw.queueDepth = L.vWest;
    state.nodes.re.queueDepth = L.vEast;
    state.nodes.rw.health = "healthy";
    state.nodes.re.health =
      partitioned && cp ? "degraded" : "healthy";
    state.metrics.diverged = L.diverged;
    state.metrics.availability = Math.min(
      (L.acceptEma / Math.max(maxRate, 0.01)) * 100,
      100,
    );
    state.metrics.rejected = L.rejectedTotal;
    state.metrics.partitioned = partitioned ? 1 : 0;
  },

  timeline: [
    {
      at: 2,
      caption:
        "Two coasts, one dataset. Violet packets keep db-west and db-east in sync.",
    },
    {
      at: 8,
      caption:
        "Flip NETWORK PARTITION. The sync link is severed — now pick your poison.",
    },
    {
      at: 16,
      caption:
        "Try both modes while split: CP rejects (red), AP diverges (watch the counter). Then heal.",
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
  ],
};
