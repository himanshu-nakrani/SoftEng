import {
  advancePackets,
  approach,
  clamp01,
  isAlive,
  killNode,
  reviveNode,
  spawnPacket,
} from "@/engine/sim-helpers";
import type { LessonSim, Packet, SimState } from "@/engine/types";

/**
 * Delivery Guarantees & Idempotency. Message Queues stopped one beat early:
 * it showed the buffer absorbing an outage, but never asked what happens to
 * the message a worker had already *taken* when it died.
 *
 * The whole lesson is one line of code — where the ack goes.
 *
 *   at-most-once:  ack on TAKE, before the work. A crash mid-work loses it.
 *   at-least-once: ack on COMPLETION, after the work. A crash mid-work
 *                  redelivers it — and the side effect runs twice.
 *
 * So the ack is made a first-class citizen on the stage: a small cyan dot
 * flying back up the `out` edge. Everything downstream of it is bookkeeping;
 * everything upstream of it is still the queue's problem.
 *
 * A payment is the load-bearing choice of side effect: repeating it is
 * visibly criminal, and the fix (an idempotency key at the db) is the real
 * one every payment processor ships.
 */

/**
 * What payments-db publishes about its dedup window, read by the figure's
 * node overlay. `lastHit` is a sim-timestamp, not a flag, so the badge can
 * fade the flash out against the snapshot clock instead of the sim owning a
 * presentation timer.
 */
export interface DedupMeta {
  /** Whether the idempotency-keys toggle is on. */
  on: boolean;
  /** Keys currently held (capped at the dedup window). */
  keys: number;
  /** Sim-time of the last duplicate absorbed; -1 = never. */
  lastHit: number;
}

/* ---------- The life of one message, as the worker sees it ---------- */

/**
 * Where the worker is with the message it owns. The two "charge issued"
 * phases are what makes a crash expensive: the money has moved (or is about
 * to), and the ack has not.
 */
type Phase =
  /** On the wire from payments-q; the worker doesn't have it yet. */
  | "delivering"
  /** In hand, doing the work. No charge has been issued. */
  | "processing"
  /** Charge is on the wire to payments-db. */
  | "charging"
  /** Charge landed; waiting for the db's confirmation before acking. */
  | "confirming";

interface Work {
  mid: number;
  phase: Phase;
  /** True once an ack has been emitted — i.e. the queue has let go. */
  acked: boolean;
  /** True when this delivery is a *re*delivery (drawn in the warning hue). */
  dupe: boolean;
  /** Sim-seconds at which `processing` ends. */
  doneAt: number;
}

interface DGState {
  /** payments-q, as message ids. Unbounded on purpose — see the note in step. */
  queue: number[];
  /** The one message worker-1 owns, or null when it is idle/dead. */
  work: Work | null;
  nextMid: number;
  /** Sim-time checkout publishes the next payment (jittered metronome). */
  nextSpawnAt: number;
  /** Ids the queue is currently redelivering; their copies draw as duplicates. */
  redelivering: number[];

  /** payments-db's bounded dedup window: the last DEDUP_WINDOW ids it charged. */
  seen: number[];
  /** Sim-time of the last duplicate the dedup set absorbed (-1 = never). */
  lastHit: number;

  /** Sim-time worker-1 comes back after a crash. */
  reviveAt: number;
  /** Aliveness last tick — one code path for button, timeline and click kills. */
  wasAlive: boolean;
  /** A crash is pending: it fires the moment the worker reaches the telling phase. */
  crashArmed: boolean;
  /** Deadline after which an armed crash fires regardless of phase. */
  crashBy: number;
  /** Crashes so far — the restart caption waits on it. */
  crashes: number;

  processed: number;
  doubleCharged: number;
  lost: number;
  absorbed: number;
}

/* ---------- Tuning ---------- */

/**
 * checkout publishes on a jittered metronome rather than a Poisson rate: at
 * roughly one payment per worker-cycle, a Poisson tail leaves multi-second
 * holes where there is simply nothing on the stage to crash. A bounded gap
 * keeps exactly one message interesting at a time — and the jitter still
 * comes from the seeded RNG, so the run stays reproducible.
 */
const PRODUCE_GAP = 1.45;
const PRODUCE_JITTER = 0.5;
const IN_SPEED = 2;
/** queue → worker. */
const DELIVER_SPEED = 2.8;
/** The work itself. */
const PROCESS_SECS = 0.35;
/** worker → db. */
const CHARGE_SPEED = 2.8;
/**
 * db → worker. THE crash window: the money has moved and the ack has not.
 * Deliberately the slowest leg — this gap is the entire lesson.
 */
const CONFIRM_SPEED = 1.8;
/** worker → queue. Small, fast, and the only thing the queue actually believes. */
const ACK_SPEED = 2.6;

/** A supervisor brings the worker back this long after it dies. */
const RESTART_SECS = 1.5;
/** payments-db remembers this many idempotency keys. Bounded — see the page. */
const DEDUP_WINDOW = 50;
/** An armed crash gives up waiting for the telling phase after this long. */
const ARM_WINDOW = 6;
/** Queue-depth bar scale. */
const DEPTH_SCALE = 8;

function midOf(p: Packet): number {
  const mid = p.payload?.mid;
  return typeof mid === "number" ? mid : -1;
}

/**
 * Everything a crash costs, in one place — reached identically by the CRASH
 * CONSUMER button, the scripted beat, and a learner clicking the node dead.
 *
 * The only question that matters: had the ack gone out yet?
 */
function onCrash(state: SimState<DGState>): void {
  const L = state.lesson;
  const w = L.work;
  L.crashes += 1;
  L.reviveAt = state.t + RESTART_SECS;

  if (w) {
    // "Charged" from the moment the charge left the worker: the db never
    // learns the worker died, so a charge already on the wire still lands.
    const charged = w.phase === "charging" || w.phase === "confirming";
    if (w.acked) {
      // at-most-once: the queue let go at take. If the charge never went out,
      // nobody will ever issue it — and nobody will ever know.
      if (!charged) L.lost += 1;
    } else {
      // at-least-once: no ack, so the message is still payments-q's problem.
      // Front of the line — redelivery is supposed to be prompt.
      L.queue.unshift(w.mid);
      if (!L.redelivering.includes(w.mid)) L.redelivering.push(w.mid);
    }
    L.work = null;
  }

  // In-flight deliveries die at the corpse (the requeue above already covers
  // them). Acks travelling the other way have already been believed.
  for (const p of state.packets) {
    if (p.edgeId === "out" && !p.reverse && p.type !== "drop") p.type = "drop";
  }
}

export const deliveryGuaranteesSim: LessonSim<DGState> = {
  id: "delivery-guarantees",

  topology: {
    nodes: [
      { id: "producer", kind: "client", label: "checkout", x: 90, y: 150 },
      { id: "queue", kind: "queue", label: "payments-q", x: 320, y: 150 },
      {
        id: "consumer",
        kind: "server",
        label: "worker-1",
        x: 550,
        y: 150,
        breakable: true,
      },
      { id: "db", kind: "database", label: "payments-db", x: 690, y: 330 },
    ],
    edges: [
      { id: "in", from: "producer", to: "queue" },
      { id: "out", from: "queue", to: "consumer" },
      // Bowed away from the queue leg so the charge/confirm traffic reads as
      // a separate limb rather than more dots on the same line.
      { id: "charge", from: "consumer", to: "db", curve: 0.45 },
    ],
  },

  params: [
    {
      key: "ackMode",
      label: "ack mode",
      kind: "select",
      options: [
        { value: "at-least-once", label: "at-least-once" },
        { value: "at-most-once", label: "at-most-once" },
      ],
      defaultValue: "at-least-once",
    },
    {
      key: "dedup",
      label: "idempotency keys",
      kind: "toggle",
      defaultValue: false,
    },
    {
      key: "crash",
      label: "crash consumer",
      kind: "button",
      defaultValue: false,
    },
  ],

  init: () => ({
    queue: [],
    work: null,
    nextMid: 1,
    nextSpawnAt: 0.5,
    redelivering: [],
    seen: [],
    lastHit: -1,
    reviveAt: 0,
    wasAlive: true,
    crashArmed: false,
    crashBy: 0,
    crashes: 0,
    processed: 0,
    doubleCharged: 0,
    lost: 0,
    absorbed: 0,
  }),

  // payments-db's badge exists before the first tick; step rewrites it after.
  initialNodes: {
    db: { meta: { on: false, keys: 0, lastHit: -1 } },
  },

  step: (state, dt, params) => {
    const L = state.lesson;
    const atLeastOnce = params.ackMode !== "at-most-once";
    const dedupOn = params.dedup === true;

    /* 1. The button. Arms a crash rather than firing it blind: a kill that
       lands while the worker is idle teaches nothing, so it waits (at most
       ARM_WINDOW) for the moment that actually exposes the guarantee —
       which is a different moment in each mode. */
    if (params.crash === true) {
      params.crash = false; // consume the press
      if (isAlive(state, "consumer")) {
        L.crashArmed = true;
        L.crashBy = state.t + ARM_WINDOW;
      }
    }
    if (L.crashArmed && isAlive(state, "consumer")) {
      const w = L.work;
      const telling = w
        ? atLeastOnce
          ? // charged, ack not yet sent — the redelivery will charge again
            w.phase === "confirming"
          : // acked at take, charge not yet issued — the work is about to vanish
            w.phase === "processing"
        : false;
      if (telling || state.t >= L.crashBy) {
        L.crashArmed = false;
        killNode(state, "consumer");
      }
    }

    /* 2. Death and resurrection. Detected as a transition, so clicking the
       node dead costs exactly what the button costs. */
    const alive = isAlive(state, "consumer");
    if (L.wasAlive && !alive) onCrash(state);
    if (!alive && state.t >= L.reviveAt) reviveNode(state, "consumer");
    L.wasAlive = isAlive(state, "consumer");
    const workerUp = L.wasAlive;

    /* 3. checkout never stops publishing. payments-q is unbounded here —
       overflow and backpressure were the previous lesson; this one is about
       what happens to a message that has already been handed out. */
    if (state.t >= L.nextSpawnAt) {
      L.nextSpawnAt = state.t + PRODUCE_GAP + state.rng() * PRODUCE_JITTER;
      spawnPacket(state, "in", "request", {
        speed: IN_SPEED,
        payload: { mid: L.nextMid++ },
      });
    }

    /* 4. Take: one message at a time, so the crash always has an obvious
       victim. The queue hands it over but does NOT forget it — that only
       happens on the ack. */
    if (workerUp && !L.work && L.queue.length > 0) {
      const mid = L.queue.shift()!;
      const dupe = L.redelivering.includes(mid);
      L.work = { mid, phase: "delivering", acked: false, dupe, doneAt: 0 };
      spawnPacket(state, "out", dupe ? "dupe" : "request", {
        speed: DELIVER_SPEED,
        size: dupe ? 5 : undefined,
        payload: { mid },
      });
    }

    /* 5. Arrivals. */
    let chargesNow = 0;
    for (const p of advancePackets(state, dt)) {
      if (p.type === "drop") continue; // died at a corpse; already accounted for
      const mid = midOf(p);
      const w = L.work;

      if (p.edgeId === "in") {
        L.queue.push(mid);
        continue;
      }

      if (p.edgeId === "out" && !p.reverse) {
        // Delivered. The worker starts working.
        if (!workerUp || !w || w.mid !== mid || w.phase !== "delivering") {
          continue;
        }
        w.phase = "processing";
        w.doneAt = state.t + PROCESS_SECS;
        if (!atLeastOnce) {
          // at-most-once: ack FIRST, work second. The queue is now free of a
          // message that has not been paid for yet.
          ack(state, w);
        }
        continue;
      }

      if (p.edgeId === "charge" && !p.reverse) {
        // The charge hits payments-db. This is where money moves — or doesn't.
        chargesNow += 1;
        applyCharge(state, mid, dedupOn);
        if (w && w.mid === mid && w.phase === "charging") w.phase = "confirming";
        spawnPacket(state, "charge", "response", {
          speed: CONFIRM_SPEED,
          reverse: true,
          size: 3,
          payload: { mid },
        });
        continue;
      }

      if (p.edgeId === "charge" && p.reverse) {
        // Confirmed. Only now, under at-least-once, is it safe to ack.
        if (!workerUp || !w || w.mid !== mid || w.phase !== "confirming") {
          continue;
        }
        L.processed += 1;
        if (atLeastOnce) ack(state, w);
        L.work = null;
        continue;
      }
      // Acks arriving back at payments-q are pure narration: the queue
      // already believed them the moment they were emitted.
    }

    /* 6. Work finishes → issue the charge. */
    const job = L.work;
    if (workerUp && job && job.phase === "processing" && state.t >= job.doneAt) {
      job.phase = "charging";
      spawnPacket(state, "charge", job.dupe ? "dupe" : "write", {
        speed: CHARGE_SPEED,
        size: job.dupe ? 5 : undefined,
        payload: { mid: job.mid },
      });
    }

    /* 7. Readouts. */
    const depth = L.queue.length;
    const queueNode = state.nodes.queue;
    queueNode.queueDepth = depth;
    queueNode.load = approach(
      queueNode.load,
      clamp01(depth / DEPTH_SCALE),
      6,
      dt,
    );
    state.nodes.producer.load = approach(state.nodes.producer.load, 0.2, 3, dt);

    const consumer = state.nodes.consumer;
    consumer.load = workerUp
      ? approach(consumer.load, L.work ? 0.7 : 0.05, 5, dt)
      : 0;

    const db = state.nodes.db;
    db.load = chargesNow > 0 ? 1 : approach(db.load, 0.05, 1.8, dt);
    // The dedup window lives in the db's node overlay (see the figure).
    const meta: DedupMeta = {
      on: dedupOn,
      keys: L.seen.length,
      lastHit: L.lastHit,
    };
    db.meta = { ...meta };

    state.metrics.processed = L.processed;
    state.metrics.depth = depth;
    state.metrics.doubleCharged = L.doubleCharged;
    state.metrics.lost = L.lost;
    state.metrics.absorbed = L.absorbed;
  },

  timeline: [
    {
      at: 1.5,
      caption:
        "Each dot is one payment. worker-1 takes it from payments-q, charges the card at payments-db, and only then tells the queue it's done.",
    },
    {
      at: 5.5,
      caption:
        "That small cyan dot flying back to payments-q is the ACK — the only signal that lets a queue forget a message. Watch WHERE in the sequence it leaves.",
    },
    {
      at: 9,
      caption:
        "ACK MODE is the whole lesson. at-least-once acks after the charge: never lost, sometimes repeated. at-most-once acks at take: never repeated, sometimes lost.",
    },
    {
      at: 10,
      caption:
        "⚡ worker-1 is about to die mid-message — at exactly the point where the ack mode decides what that costs.",
      apply: (s) => {
        s.lesson.crashArmed = true;
        s.lesson.crashBy = s.t + ARM_WINDOW;
      },
    },
    {
      at: 21,
      caption:
        "Now break it yourself: flip IDEMPOTENCY KEYS on and press CRASH CONSUMER, then try the same crash in at-most-once.",
    },

    /* The beats below wait on the learner's run, not the clock: each narrates
       a consequence the first time it actually occurs — scripted crash, button
       press, or a click on worker-1 ten minutes from now. Later entries win a
       tie, so the specific outcome (loss, duplicate) beats the generic one. */
    {
      at: 3,
      when: (s, params) =>
        !isAlive(s, "consumer") && params.ackMode !== "at-most-once",
      caption:
        "☠ Crashed after charging, before acking. payments-q never heard an ack — so the message is still its problem.",
    },
    {
      at: 3,
      when: (s) =>
        s.lesson.crashes >= 1 &&
        isAlive(s, "consumer") &&
        s.lesson.redelivering.length > 0,
      caption:
        "worker-1 restarts, and payments-q hands back the message it never got an ack for — orange, because it is the second copy.",
    },
    {
      at: 3,
      when: (s) => s.lesson.doubleCharged >= 1,
      caption:
        "💸 Charged twice. 'at-least-once' means AT LEAST once — the redelivery is the feature and the bug.",
    },
    {
      at: 3,
      when: (s) => s.lesson.absorbed >= 1,
      caption:
        "The duplicate still arrived — payments-db just recognised the key and refused to charge it again. Same delivery, different consequence.",
    },
    {
      at: 3,
      when: (s) => s.lesson.lost >= 1,
      caption:
        "💀 Gone. The ack went out at take, so payments-q deleted the message before any work happened. Nothing to redeliver, and no counter anywhere says a payment is missing.",
    },
  ],

  quiz: [
    {
      // Fires just after the scripted crash, with the worker dead and the
      // charge already landed — the premise the question states is on screen.
      id: "dg-redelivery",
      at: 12.5,
      question:
        "worker-1 crashed after charging the card but before acking. With at-least-once delivery, what happens on redelivery?",
      choices: [
        {
          id: "again",
          label: "The charge runs again — unless an idempotency key dedupes it",
        },
        {
          id: "skipped",
          label: "The queue sees the charge landed and skips the message",
        },
        {
          id: "lost",
          label: "The payment is lost — the crash killed the only copy",
        },
      ],
      correctChoiceId: "again",
      explain:
        "The only evidence a queue has that a message was handled is the ack, and no ack arrived — so it redelivers, and the next worker runs the same charge a second time. That is precisely what at-least-once buys: never lost, sometimes repeated. Move the ack earlier and you trade duplicates for losses; there is no third setting, because the ack and the side effect can never be made atomic across a network. 'Exactly once' as a *delivery* guarantee is a lie. What is real is an exactly-once EFFECT: a consumer that recognises a key it already processed and returns the same answer without charging again.",
    },
    {
      // Ungated on the clock but gated on the state: it fires the first time
      // the learner is in at-most-once with an acked, unfinished message in
      // the worker's hands — the exact instant the other failure is possible.
      id: "dg-lost",
      at: 15,
      when: (s, params) =>
        params.ackMode === "at-most-once" &&
        s.lesson.work !== null &&
        s.lesson.work.acked &&
        s.lesson.work.phase === "processing",
      question:
        "at-most-once: worker-1 acked this message the instant it took it, and is still processing. It dies right now. What happens?",
      choices: [
        {
          id: "gone",
          label: "Nothing — the card is never charged, and nobody ever finds out",
        },
        {
          id: "redeliver",
          label: "payments-q redelivers it once worker-1 restarts",
        },
        { id: "double", label: "It gets charged twice, same as before" },
      ],
      correctChoiceId: "gone",
      explain:
        "The ack already went out, so payments-q deleted the message before any work happened. There is nothing to redeliver and nothing to retry — the payment simply never occurred, and no counter anywhere in the system is wrong enough to notice. That is the trade: at-most-once has no duplicates and no safety net. It is the right setting for a metrics ping and a resignation letter for a payment.",
    },
  ],

  packetStyles: {
    // A redelivered message and its second charge — the warning hue, kept
    // clear of the amber that ordinary work rides on.
    dupe: { color: "var(--color-glow-orange)", size: 5 },
    // Bookkeeping, not payload: the ack is the smallest dot on the stage and
    // the only one the queue cares about. Cyan is the demoted, info hue.
    ack: { color: "var(--color-glow-cyan)", size: 3.5 },
  },

  meters: [
    { metricKey: "processed", label: "processed", kind: "counter" },
    {
      metricKey: "depth",
      label: "queue depth",
      kind: "bar",
      max: DEPTH_SCALE,
    },
    {
      // The at-least-once failure: the money moved twice.
      metricKey: "doubleCharged",
      label: "double charged",
      kind: "counter",
      dangerAbove: 0,
    },
    {
      // The at-most-once failure: the money never moved at all.
      metricKey: "lost",
      label: "lost payments",
      kind: "counter",
      dangerAbove: 0,
    },
    {
      // The fix, working: duplicates that arrived and cost nothing.
      metricKey: "absorbed",
      label: "deduped",
      kind: "counter",
    },
  ],
};

/* ---------- Verbs used above ---------- */

/**
 * Emit the ack: the queue lets go of the message here and nowhere else. The
 * packet is narration — the queue believes it the instant it is sent — but
 * *where* in the sequence this call sits is the entire guarantee.
 */
function ack(state: SimState<DGState>, w: Work): void {
  const L = state.lesson;
  w.acked = true;
  L.redelivering = L.redelivering.filter((mid) => mid !== w.mid);
  spawnPacket(state, "out", "ack", {
    speed: ACK_SPEED,
    reverse: true,
    payload: { mid: w.mid },
  });
}

/**
 * payments-db applies a charge.
 *
 * The `seen` window is kept whether or not idempotency is switched on — with
 * the toggle off it is the narrator's ledger (how else would a meter know a
 * charge was a repeat?), and with it on it is the mechanism itself. That is
 * the honest shape of the fix: the same record, consulted instead of ignored.
 */
function applyCharge(
  state: SimState<DGState>,
  mid: number,
  dedupOn: boolean,
): void {
  const L = state.lesson;
  const repeat = L.seen.includes(mid);

  if (repeat && dedupOn) {
    L.absorbed += 1;
    L.lastHit = state.t;
    return;
  }
  if (repeat) {
    L.doubleCharged += 1;
    return;
  }

  L.seen.push(mid);
  if (L.seen.length > DEDUP_WINDOW) L.seen.shift();
}
