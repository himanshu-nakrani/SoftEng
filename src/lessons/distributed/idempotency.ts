import { advancePackets, shouldSpawn, spawnPacket } from "@/engine/sim-helpers";
import type { LessonSim, SimState } from "@/engine/types";

/**
 * B4 — Idempotency. Payments over a lossy network: responses vanish, the
 * client times out and retries, and the server — unable to tell a retry
 * from a new order — charges again. Idempotency keys make retries safe.
 *
 * Packet language: amber = payment attempt · green = confirmation ·
 * violet = "already did this one" (dedupe hit) · red = lost on the wire.
 */

interface Payment {
  id: number;
  sentAt: number;
  attempts: number;
}

interface IdemState {
  pending: Payment[];
  nextId: number;
  /** Server-side ledger of idempotency keys it has processed. */
  seen: Record<number, true>;
  charges: number;
  duplicates: number;
  completed: number;
  retries: number;
  abandoned: number;
}

const TIMEOUT = 2.5; // client gives up waiting and retries
const MAX_ATTEMPTS = 3;
const SPEED = 1.4;

function sendAttempt(state: SimState<IdemState>, payment: Payment) {
  payment.sentAt = state.t;
  payment.attempts += 1;
  spawnPacket(state, "wire", "request", {
    speed: SPEED,
    payload: { id: payment.id },
  });
}

export const idempotencySim: LessonSim<IdemState> = {
  id: "idempotency",

  topology: {
    nodes: [
      { id: "client", kind: "client", label: "checkout", x: 150, y: 225 },
      { id: "api", kind: "server", label: "payments", x: 640, y: 225 },
    ],
    edges: [{ id: "wire", from: "client", to: "api" }],
  },

  params: [
    {
      key: "rate",
      label: "payments",
      kind: "slider",
      min: 1,
      max: 8,
      step: 1,
      unit: " /s",
      defaultValue: 3,
    },
    {
      key: "loss",
      label: "response loss",
      kind: "slider",
      min: 0,
      max: 50,
      step: 5,
      unit: "%",
      defaultValue: 25,
    },
    {
      key: "keys",
      label: "idempotency keys",
      kind: "toggle",
      defaultValue: false,
    },
  ],

  init: () => ({
    pending: [],
    nextId: 1,
    seen: {},
    charges: 0,
    duplicates: 0,
    completed: 0,
    retries: 0,
    abandoned: 0,
  }),

  step: (state, dt, params) => {
    const L = state.lesson;
    const useKeys = params.keys === true;
    const pLoss = Number(params.loss) / 100;

    // 1. New payments.
    for (let i = 0; i < shouldSpawn(state, Number(params.rate), dt); i++) {
      const payment: Payment = { id: L.nextId++, sentAt: state.t, attempts: 0 };
      L.pending.push(payment);
      sendAttempt(state, payment);
      state.metrics.attempted = L.nextId - 1;
    }

    // 2. Timeouts → retries (the client can't know WHY it heard nothing).
    for (const payment of L.pending) {
      if (state.t - payment.sentAt > TIMEOUT) {
        if (payment.attempts < MAX_ATTEMPTS) {
          L.retries += 1;
          sendAttempt(state, payment);
        } else {
          payment.attempts = Infinity; // abandoned; swept below
          L.abandoned += 1;
        }
      }
    }
    L.pending = L.pending.filter((p) => p.attempts !== Infinity);

    // 3. Deliveries.
    for (const p of advancePackets(state, dt)) {
      const id = Number(p.payload?.id ?? 0);
      if (p.type === "request") {
        // At the server: charge — or recognize the key.
        let responseType: "response" | "replication" = "response";
        if (useKeys && L.seen[id]) {
          responseType = "replication"; // "already did this" — no new charge
        } else {
          if (L.seen[id]) L.duplicates += 1; // charged before, charging again
          L.charges += 1;
          L.seen[id] = true;
        }
        // The response may not survive the trip home.
        if (state.rng() < pLoss) {
          spawnPacket(state, "wire", "drop", {
            speed: SPEED * 1.2,
            reverse: true,
            size: 3,
          });
        } else {
          spawnPacket(state, "wire", responseType, {
            speed: SPEED,
            reverse: true,
            payload: { id },
            size: responseType === "replication" ? 3 : undefined,
          });
        }
      } else if (p.type === "response" || p.type === "replication") {
        // Confirmation reached the client.
        const idx = L.pending.findIndex((pay) => pay.id === id);
        if (idx >= 0) {
          L.pending.splice(idx, 1);
          L.completed += 1;
        }
      }
      // drops die on arrival — the lost confirmation
    }

    // 4. Readouts.
    state.nodes.api.queueDepth = L.charges;
    state.nodes.client.queueDepth = L.pending.length;
    state.metrics.charges = L.charges;
    state.metrics.completed = L.completed;
    state.metrics.duplicates = L.duplicates;
    state.metrics.retries = L.retries;
  },

  timeline: [
    {
      at: 2,
      caption:
        "The api's chip counts CHARGES. checkout's chip counts payments still waiting.",
    },
    {
      at: 8,
      caption:
        "A red fade = a confirmation that died on the wire. The client will time out and retry…",
    },
    {
      at: 16,
      caption:
        "⚠ CHARGES is outrunning COMPLETED. Flip IDEMPOTENCY KEYS and watch the violet dedupe hits.",
    },
  ],

  quiz: [
    {
      id: "retry-blind",
      at: 12,
      question:
        "A confirmation is lost; the client times out and re-sends the payment. WITHOUT idempotency keys, what can the server do?",
      choices: [
        {
          id: "blind",
          label: "Charge again — it cannot distinguish a retry from a new order",
        },
        { id: "amount", label: "Detect the duplicate by matching the amount" },
        { id: "refuse", label: "Refuse all repeated requests within a window" },
      ],
      correctChoiceId: "blind",
      explain:
        "From the server's side both requests are identical and legitimate — two orders for the same amount is a normal Tuesday. Only a client-chosen stable key ('this is attempt N of payment X') lets the server recognize the same INTENT twice. Matching amounts breaks real orders; refusing repeats breaks real retries.",
    },
  ],

  meters: [
    {
      metricKey: "completed",
      label: "confirmed",
      kind: "counter",
    },
    {
      metricKey: "charges",
      label: "charges made",
      kind: "counter",
    },
    {
      metricKey: "duplicates",
      label: "double charges",
      kind: "counter",
      dangerAbove: 0,
    },
    {
      metricKey: "retries",
      label: "retries",
      kind: "counter",
    },
  ],
};
