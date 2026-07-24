import {
  advancePackets,
  approach,
  clamp01,
  shouldSpawn,
  spawnPacket,
} from "@/engine/sim-helpers";
import type { LessonSim, SimState } from "@/engine/types";

/**
 * The landing-page ambient simulation: a load-balanced cluster that runs
 * forever. Traffic breathes sinusoidally; visitors can kill servers and the
 * cluster self-heals after a few seconds — the pitch, wordlessly.
 */

const SERVERS = ["a", "b", "c"] as const;
type Sid = (typeof SERVERS)[number];

interface HeroState {
  servers: Record<Sid, { queue: number; acc: number }>;
  rr: number;
  deadSince: Partial<Record<Sid, number>>;
}

const CAPACITY = 7;
const MAX_QUEUE = 8;
const HEAL_AFTER = 6; // seconds a server stays dead before self-healing

export const heroSim: LessonSim<HeroState> = {
  id: "hero",

  topology: {
    nodes: [
      { id: "client", kind: "client", label: "traffic", x: 120, y: 210 },
      { id: "lb", kind: "loadbalancer", label: "lb-1", x: 330, y: 210 },
      { id: "a", kind: "server", label: "api-1", x: 600, y: 90, breakable: true },
      { id: "b", kind: "server", label: "api-2", x: 640, y: 210, breakable: true },
      { id: "c", kind: "server", label: "api-3", x: 600, y: 330, breakable: true },
    ],
    edges: [
      { id: "in", from: "client", to: "lb" },
      { id: "to-a", from: "lb", to: "a", curve: -0.12 },
      { id: "to-b", from: "lb", to: "b" },
      { id: "to-c", from: "lb", to: "c", curve: 0.12 },
    ],
  },

  params: [],
  meters: [],

  init: () => ({
    servers: {
      a: { queue: 0, acc: 0 },
      b: { queue: 0, acc: 0 },
      c: { queue: 0, acc: 0 },
    },
    rr: 0,
    deadSince: {},
  }),

  step: (state: SimState<HeroState>, dt) => {
    const L = state.lesson;

    // Self-heal: revive servers a few seconds after they die.
    for (const id of SERVERS) {
      if (state.nodes[id].health === "dead") {
        if (L.deadSince[id] === undefined) L.deadSince[id] = state.t;
        if (state.t - (L.deadSince[id] ?? 0) > HEAL_AFTER) {
          state.nodes[id].health = "healthy";
          delete L.deadSince[id];
        }
      } else {
        delete L.deadSince[id];
      }
    }

    const alive = SERVERS.filter((id) => state.nodes[id].health !== "dead");

    // Breathing traffic.
    const rate = 9 + 5 * Math.sin(state.t / 4);
    for (let i = 0; i < shouldSpawn(state, rate, dt); i++) {
      spawnPacket(state, "in", "request", { speed: 1.5 });
    }

    for (const p of advancePackets(state, dt)) {
      if (p.edgeId === "in") {
        if (p.type === "request") {
          if (alive.length === 0) {
            spawnPacket(state, "in", "drop", { speed: 1.8, reverse: true, size: 3 });
          } else {
            // least-conn keeps the ambient load visibly balanced
            const target = alive.reduce((best, id) =>
              L.servers[id].queue < L.servers[best].queue ? id : best,
            );
            spawnPacket(state, `to-${target}`, "request", { speed: 1.3 });
          }
        }
      } else {
        const sid = p.edgeId.slice(3) as Sid;
        if (p.type === "request") {
          if (state.nodes[sid].health === "dead" || L.servers[sid].queue >= MAX_QUEUE) {
            spawnPacket(state, p.edgeId, "drop", { speed: 1.6, reverse: true, size: 3 });
          } else {
            L.servers[sid].queue += 1;
          }
        } else if (p.type === "response") {
          spawnPacket(state, "in", "response", { speed: 1.5, reverse: true });
        }
      }
    }

    for (const id of SERVERS) {
      const server = L.servers[id];
      if (state.nodes[id].health === "dead") {
        server.queue = 0;
        continue;
      }
      server.acc += CAPACITY * dt;
      while (server.acc >= 1 && server.queue > 0) {
        server.acc -= 1;
        server.queue -= 1;
        spawnPacket(state, `to-${id}`, "response", { speed: 1.3, reverse: true });
      }
      if (server.queue === 0) server.acc = Math.min(server.acc, 1);
      state.nodes[id].load = approach(
        state.nodes[id].load,
        clamp01(server.queue / MAX_QUEUE),
        6,
        dt,
      );
    }
  },
};
