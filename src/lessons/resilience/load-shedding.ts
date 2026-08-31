import {
  advancePackets,
  approach,
  bounceDrop,
  clamp01,
  drainQueue,
  isAlive,
  shouldSpawn,
  spawnPacket,
  type ServiceQueue,
} from "@/engine/sim-helpers";
import type { LessonSim } from "@/engine/types";

/**
 * Lesson — Load Shedding. clients → api-1, one bounded worker behind a queue.
 *
 * The whole lesson is one contrast at a single arrival rate the server cannot
 * meet: a queue that ACCEPTS everything versus one that REFUSES early.
 *
 *   ACCEPT-ALL   every arrival joins the queue. The queue grows without
 *                bound, so a request's wait is (its place in line / capacity)
 *                — and that place keeps getting deeper. Past a deadline the
 *                answer is worthless: the caller has already given up, so the
 *                work the server finally does lands on a client that is gone.
 *                Latency is unbounded and GOODPUT — answers delivered before
 *                their deadline — collapses to nearly zero. The server is
 *                100% busy and serving almost nobody usefully.
 *   SHED         admission control. When the queue is already deep enough that
 *                a new arrival could not be served before its deadline, REFUSE
 *                it at the door — instantly, cheaply (a 429). The accepted work
 *                stays inside the deadline, so goodput holds near capacity even
 *                though the server turns most arrivals away.
 *
 * THE WORD MATTERS. A request the server REFUSES by policy is REJECTED
 * (`limited`, the amber 429 bounce). A request lost because the box died, or
 * because a bounded queue physically overflowed, is DROPPED (`drop`, red).
 * Shedding is a policy, so it rejects; it never "drops". The meters keep the
 * two counts apart on purpose.
 *
 * UNITS. Sim time is the animation's clock. Wait time is reported in modeled
 * milliseconds: a request that has waited `depth/capacity` sim-seconds in line
 * is priced at MS_PER_SEC per second, and DEADLINE_MS is the caller's patience.
 * A packet's speed carries its own service time so the stall is watchable — a
 * request that will wait a long time crawls its edge — but high volume lives in
 * the numeric queue chip and the meters, never in more dots (the pool caps at
 * 128).
 */

interface LoadSheddingState {
  /** The single worker's backlog. */
  queue: ServiceQueue;
  /** Requests refused by admission control — POLICY. The 429 count. */
  rejected: number;
  /** Requests lost to capacity: overflow of the hard cap, or a dead box. */
  dropped: number;
  /** Answers delivered inside the deadline — the number that matters. */
  goodput: number;
  /** Answers delivered too late to matter — work the server wasted. */
  wasted: number;
  /** Smoothed wait of the last few served requests, in ms. */
  waitMs: number;
  /** Latches once the learner kills the box, to retire the closing nudge. */
  everKilled: boolean;
  /** Scripted window forcing shedding ON regardless of the toggle. */
  scriptShedUntil: number;
  /** Scripted window forcing shedding OFF (the queue-of-death beat). */
  scriptAcceptUntil: number;
}

/**
 * A HARD ceiling on the accept-all queue. Real queues are bounded by memory;
 * this one is large enough that within the lesson's window it behaves as
 * "unbounded" (the wait blows past the deadline long before it is reached), but
 * finite so that overflow past it is an honest DROP — capacity loss — distinct
 * from a policy REJECT. See the word note at the top.
 */
const HARD_CAP = 400;

/** Bar scale for the queue meter — the interesting range, not the hard cap. */
const QUEUE_SCALE = 120;

/** Modeled wall-clock: a second spent waiting in line, and the caller's patience. */
const MS_PER_SEC = 1000;
const DEADLINE_MS = 2000;

/** Deadline expressed as a queue depth for a given capacity: wait = depth/cap. */
function deadlineDepth(capacity: number): number {
  return (DEADLINE_MS / MS_PER_SEC) * capacity;
}

/**
 * Admission control admits only while the queue is below this FRACTION of the
 * full deadline depth. 0.7 leaves headroom so an admitted request is served
 * comfortably inside the deadline (wait ~1400ms against a 2000ms deadline)
 * rather than right on the edge, which is what keeps goodput useful.
 */
const ADMIT_HEADROOM = 0.7;

/**
 * When shedding turns on with a deep pre-existing backlog, the doomed portion
 * (everything past the admission line — it will time out before service) is
 * refused at up to this many req/s, so the queue snaps down to the admission
 * threshold over about a second rather than in one jarring frame.
 */
const SHED_BACKLOG_RATE = 220;

/** Base dot speed — how fast a request crawls the wire toward the server. */
const IN_SPEED = 1.6;
const OUT_SPEED = 1.7;
const DROP_SPEED = 2.0;

export const loadSheddingSim: LessonSim<LoadSheddingState> = {
  id: "load-shedding",

  topology: {
    nodes: [
      { id: "client", kind: "client", label: "clients", x: 150, y: 225 },
      {
        id: "server",
        kind: "server",
        label: "api-1",
        x: 640,
        y: 225,
        breakable: true,
      },
    ],
    edges: [{ id: "wire", from: "client", to: "server" }],
  },

  params: [
    {
      key: "rate",
      label: "arrival rate",
      kind: "slider",
      min: 4,
      max: 40,
      step: 1,
      unit: " req/s",
      // Default is well past the server's 12 req/s: overload is the whole
      // lesson, so the baseline is already underwater.
      defaultValue: 24,
    },
    {
      key: "capacity",
      label: "server capacity",
      kind: "slider",
      min: 4,
      max: 30,
      step: 1,
      unit: " req/s",
      defaultValue: 12,
    },
    {
      key: "shed",
      label: "shed at the door",
      kind: "toggle",
      defaultValue: false,
    },
  ],

  init: () => ({
    queue: { depth: 0, acc: 0 },
    rejected: 0,
    dropped: 0,
    goodput: 0,
    wasted: 0,
    waitMs: 0,
    everKilled: false,
    scriptShedUntil: 0,
    scriptAcceptUntil: 0,
  }),

  step: (state, dt, params) => {
    const L = state.lesson;
    const rate = Number(params.rate);
    const capacity = Number(params.capacity);
    const alive = isAlive(state, "server");
    if (!alive) L.everKilled = true;

    // Mode resolution (the pattern tail-latency/circuit-breaker use): a
    // scripted window forces a regime, a shorter hold forces the other, and
    // outside both the learner's toggle is authoritative. The engine cannot
    // write `params` from a timeline event, so scripted intent lives in state.
    const forcedAccept = state.t < L.scriptAcceptUntil;
    const forcedShed = !forcedAccept && state.t < L.scriptShedUntil;
    const shedding = forcedShed || (!forcedAccept && params.shed === true);

    // The admission threshold: refuse a new arrival once the queue is already
    // deep enough that this arrival could not be served comfortably inside the
    // deadline. Read off the live capacity (so it is not a magic constant), at
    // a safety fraction of the full deadline depth — admitting right up to the
    // deadline would leave every accepted request on the knife's edge.
    const admitBelow = deadlineDepth(capacity) * ADMIT_HEADROOM;

    /** A request refused by POLICY: the amber 429 bounce. Not a drop. */
    const reject = () => {
      L.rejected += 1;
      bounceDrop(state, "wire", { type: "limited", speed: DROP_SPEED });
    };

    /** A request lost to CAPACITY: overflow, or a dead box. Red drop. */
    const drop = () => {
      L.dropped += 1;
      bounceDrop(state, "wire", { type: "drop", speed: DROP_SPEED });
    };

    // Deadline-aware shedding of the BACKLOG. When shedding turns on with a
    // queue already too deep to meet the deadline, the work sitting past the
    // admission line is doomed no matter what — every one of those requests
    // will time out before it is served. So shed it: refuse it by policy
    // (reject) rather than spending the server on answers nobody will use.
    // This is what lets goodput recover instead of the stale backlog poisoning
    // every served request until it finally drains. Capped per tick so the
    // queue snaps down over a second or so rather than in one frame.
    if (alive && shedding && L.queue.depth > admitBelow) {
      const doomed = Math.min(
        L.queue.depth - admitBelow,
        Math.ceil(SHED_BACKLOG_RATE * dt),
      );
      L.queue.depth -= doomed;
      // Queued work is abstract depth, not in-flight dots, so this only moves
      // the counter — the amber bounce is reserved for arrivals refused AT THE
      // DOOR, which is where the learner watches the policy act.
      L.rejected += doomed;
    }

    // 1. Arrivals. A dot per arrival while the pool has room; the count is the
    //    truth, the dots are a sample of it.
    const spawns = shouldSpawn(state, rate, dt);
    for (let i = 0; i < spawns; i++) {
      spawnPacket(state, "wire", "request", { speed: IN_SPEED });
    }

    // 2. Deliveries / admission. Admission is decided when the arrival reaches
    //    the server, not when it is spawned, so flipping SHED takes effect on
    //    the next arrival to land rather than a hop later.
    for (const p of advancePackets(state, dt)) {
      if (p.edgeId !== "wire") continue;

      if (p.type === "request" && !p.reverse) {
        if (!alive) {
          // A dead box refuses nothing by policy — it simply loses the work.
          drop();
        } else if (shedding && L.queue.depth >= admitBelow) {
          // POLICY refusal: the queue is already too deep to beat the
          // deadline, so turn this arrival away cheaply instead of admitting
          // work that would be wasted.
          reject();
        } else if (L.queue.depth >= HARD_CAP) {
          // The accept-all queue physically overflowed: capacity loss, a DROP.
          drop();
        } else {
          // Admitted. Stamp the depth it entered behind — that is its wait.
          L.queue.depth += 1;
        }
      } else if (p.reverse && (p.type === "response" || p.type === "wasted")) {
        const useful = p.type === "response";
        if (useful) L.goodput += 1;
        else L.wasted += 1;
      }
      // "limited"/"drop" bounces just fade out on arrival at the client.
    }

    // 3. Service: the worker drains its queue at `capacity`, unless it is dead
    //    (then the backlog freezes exactly where it stood). The request being
    //    served waited behind everyone ahead of it, so its wait is the queue
    //    depth AT THE MOMENT IT IS SERVED, divided by capacity — priced in ms.
    //    Whether that beats the deadline decides goodput vs. wasted work.
    if (alive) {
      drainQueue(L.queue, capacity, dt, () => {
        // `drainQueue` has already decremented depth for this item; the one
        // being served was at the front, so its wait is what is still behind
        // it plus itself — one deeper than the current depth.
        const waitMs = ((L.queue.depth + 1) / capacity) * MS_PER_SEC;
        const useful = waitMs <= DEADLINE_MS;
        L.waitMs = approach(L.waitMs, waitMs, 4, dt);
        // A late answer still travels home — the server did the work — but it
        // arrives as "wasted": nobody is waiting for it any more.
        const speed = OUT_SPEED / (1 + waitMs / MS_PER_SEC);
        spawnPacket(state, "wire", useful ? "response" : "wasted", {
          speed,
          reverse: true,
        });
      });
    }

    // 4. Readouts.
    state.metrics.goodput = L.goodput;
    state.metrics.queue = L.queue.depth;
    state.metrics.wait = alive ? L.waitMs : 0;
    state.metrics.rejected = L.rejected;
    state.metrics.dropped = L.dropped;

    // The load bar: a live server working a backlog is pinned at 100% — that
    // is the point, it is never idle and still serving nobody usefully.
    const target = !alive ? 0 : L.queue.depth > 0 ? 1 : clamp01(rate / capacity);
    state.nodes.server.load = approach(state.nodes.server.load, target, 6, dt);
    state.nodes.server.queueDepth = Math.round(L.queue.depth);
  },

  timeline: [
    {
      at: 1.5,
      caption:
        "Cyan → requests, green ← answers. Arrivals (24/s) already outrun the server (12/s).",
    },
    {
      at: 5,
      caption:
        "ACCEPT-ALL: every request joins the queue. Watch the queue chip climb and the wait meter with it — nothing is refused, so nothing bounds it.",
      apply: (s) => {
        s.lesson.scriptAcceptUntil = 16;
      },
    },
    {
      at: 12,
      caption:
        "The queue is so deep that answers now arrive AFTER the caller gave up: goodput — useful answers — is collapsing while the server runs flat out.",
    },
    {
      at: 16,
      caption:
        "SHED: refuse a request the moment the queue is too deep to beat the deadline. That is a POLICY reject (amber 429), not a drop — and the accepted work stays fast.",
      apply: (s) => {
        s.lesson.scriptShedUntil = 30;
      },
    },
    {
      at: 22,
      caption:
        "Same 24/s arriving. The server turns most of it away, but goodput has recovered near capacity: fast answers to a few beat slow answers to nobody.",
    },
    {
      at: 27,
      caption:
        "☠ Click api-1 — a dead box has no policy to apply, so every arrival is DROPPED (red), capacity loss, not a refusal.",
      when: (s) => !s.lesson.everKilled,
    },
    {
      at: 27,
      caption:
        "Dead: arrivals drop (red), the backlog is frozen. Click again to revive and watch it drain.",
      when: (s) => !isAlive(s, "server"),
    },
  ],

  quiz: [
    {
      /*
       * Ungated, pinned to the clock. ACCEPT-ALL has been forced on since t=5,
       * so at t=13 the premise is on screen: the queue is deep and climbing,
       * the wait meter is well past the 2000ms deadline, and goodput has begun
       * falling while the server's load bar sits at 100%. The proof — goodput
       * cratering toward zero — arrives over the next few seconds, and the
       * counter-example (shedding at t=16) right after it. Verified headless at
       * seed 42 with the runner BEFORE this answer was written.
       */
      id: "load-shedding-overload",
      at: 13,
      question:
        "Arrivals (24/s) are stuck above the server's capacity (12/s) and it accepts everything. The queue keeps growing. What happens to the useful work — answers delivered before the caller gives up?",
      choices: [
        {
          id: "collapse",
          label: "It collapses toward zero — the wait grows past the deadline, so answers arrive too late to matter",
        },
        {
          id: "capacity",
          label: "It holds steady at the server's capacity — the queue just absorbs the overflow",
        },
        {
          id: "grows",
          label: "It grows with the queue — more work queued means more work eventually done",
        },
      ],
      correctChoiceId: "collapse",
      explain:
        "A queue that accepts everything does not add capacity; it adds WAITING. Every admitted request sits behind the whole backlog, so its wait is (queue depth / capacity) — and the backlog only grows while arrivals exceed capacity. Once that wait passes the caller's deadline, the answer is worthless the instant it is produced: the server is 100% busy doing work nobody is waiting for any more. Accepting everything is how an overloaded system serves NOBODY usefully. The fix is to refuse work early — shed load — so the requests you DO accept stay inside the deadline. Fast answers to a few beat slow answers to none.",
    },
  ],

  meters: [
    {
      metricKey: "goodput",
      label: "useful answers",
      kind: "counter",
    },
    {
      metricKey: "queue",
      label: "server queue",
      kind: "bar",
      max: QUEUE_SCALE,
      dangerAbove: QUEUE_SCALE * 0.5,
    },
    {
      metricKey: "wait",
      label: "queue wait",
      kind: "counter",
      unit: " ms",
      decimals: 0,
      dangerAbove: DEADLINE_MS,
    },
    {
      // POLICY refusals — shedding. Amber, never red: a reject is not a wound.
      metricKey: "rejected",
      label: "rejected (429)",
      kind: "counter",
    },
    {
      // CAPACITY loss — overflow or a dead box. Red: this is lost work.
      metricKey: "dropped",
      label: "dropped",
      kind: "counter",
      dangerAbove: 0,
    },
  ],

  packetStyles: {
    /** A late answer: the server did the work, but nobody is waiting. */
    wasted: { color: "var(--color-glow-orange)", size: 4, fadeOut: true },
  },

  packetLegend: [
    { type: "request", label: "request" },
    { type: "response", label: "useful answer (in time)" },
    { type: "wasted", label: "answer too late to matter" },
    { type: "limited", label: "rejected — shed by policy (429)" },
    { type: "drop", label: "dropped — capacity loss" },
  ],
};
