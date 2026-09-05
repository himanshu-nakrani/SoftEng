import { advancePackets, shouldSpawn, spawnPacket } from "@/engine/sim-helpers";
import type { LessonSim } from "@/engine/types";

/**
 * The TLS Handshake: 1-RTT to 0-RTT — archetype A (the packet engine).
 *
 * TODO: topology, params, step. All randomness through `state.rng`;
 * `Math.random` is lint-banned here. Verify any prediction checkpoint's premise
 * at seed 42 by driving `createRunner` before trusting the prose.
 *
 * `src/lessons/scaling/client-server.ts` is the minimal reference.
 */

/** Per-lesson state. `state.lesson` is this; mutate it in place in `step`. */
interface TlsHandshakeState {
  /** TODO: replace. Counters and queues live here, never in module scope. */
  requests: number;
}

export const tlsHandshakeSim: LessonSim<TlsHandshakeState> = {
  id: "tls-handshake",
  topology: {
    nodes: [
      { id: "client", kind: "client", label: "browser", x: 160, y: 225 },
      { id: "server", kind: "server", label: "api-1", x: 640, y: 225, breakable: true },
    ],
    edges: [{ id: "wire", from: "client", to: "server" }],
  },
  params: [
    {
      key: "rate",
      label: "traffic",
      kind: "slider",
      min: 1,
      max: 20,
      step: 1,
      unit: " req/s",
      defaultValue: 6,
    },
  ],
  init: () => ({ requests: 0 }),
  // `params` is ParamValues (Record<string, ParamValue>), so read through
  // Number()/String() rather than declaring a narrower parameter type — a
  // narrowed type is not assignable to the interface.
  step: (state, dt, params) => {
    const L = state.lesson;
    const rate = Number(params.rate);

    // shouldSpawn returns a COUNT for this tick. Note the argument order:
    // (state, rate, dt).
    const spawns = shouldSpawn(state, rate, dt);
    for (let i = 0; i < spawns; i++) {
      spawnPacket(state, "wire", "request");
      L.requests += 1;
    }

    for (const packet of advancePackets(state, dt)) {
      void packet; // TODO: handle arrivals — queue, serve, drop, respond.
    }

    // Publish every metric a meter reads. `invariants.test.ts` fails a meter
    // whose `metricKey` is never written, because it would render blank.
    state.metrics.requests = L.requests;
  },
  meters: [{ metricKey: "requests", label: "requests", kind: "counter" }],
};
