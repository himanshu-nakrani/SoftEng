import {
  advancePackets,
  approach,
  clamp01,
  drainQueue,
  emaRate,
  recordSample,
  shouldSpawn,
  spawnPacket,
  type ServiceQueue,
} from "@/engine/sim-helpers";
import type { LessonSim, ParamValue } from "@/engine/types";

/**
 * Lesson — Fan-out: Push vs Pull.
 *
 * One poster, one reader, and the question every social timeline has to
 * answer: do you do the work at WRITE time (push a copy of the post into
 * every follower's timeline) or at READ time (pull the authors' posts and
 * merge them when someone opens the app)?
 *
 * THE PACKET-POOL PROBLEM, AND HOW THIS LESSON RESPECTS IT
 * --------------------------------------------------------
 * A five-million-follower post is five million timeline writes. The engine
 * pools 128 packet elements, so the storm CANNOT be dots — and shouldn't be:
 * nobody can count five million of anything. Everything about the storm is
 * therefore an aggregate:
 *
 *   - the post itself is ONE packet, carrying its cost as a payload number;
 *   - the fan-out is ONE batch packet, which lands on the queue as `+N`;
 *   - the backlog is a NUMBER (`metrics.backlog`), drawn as a log-scaled load
 *     bar on the queue node and printed compactly by the figure's overlay;
 *   - the drain is a fixed handful of sample dots per second (DRAIN_DOTS),
 *     each standing for hundreds of real writes;
 *   - one pull-mode feed load is ONE dot, whatever its fan-in width; the
 *     width lives in the "reads / feed load" meter.
 *
 * Peak in-flight packets stays around 40 even with every slider maxed.
 *
 * THE ARC
 * -------
 * observe (t=10: a normal-scale post drains before you finish reading the
 * caption) → manipulate (crank the decade slider, press POST, watch the
 * backlog explode and staleness climb into the minutes) → predict (t=16.5
 * checkpoint, premised on meters the learner is looking at) → fix (flip to
 * hybrid and post again: one write, flat).
 */

export type FanoutMode = "push" | "pull" | "hybrid";

/** Timeline writes/sec the follower-timeline fleet can actually apply. */
export const DRAIN_RATE = 2000;
/** The scripted celebrity's audience — the number the checkpoint asks about. */
export const CELEB_FOLLOWERS = 5_000_000;
/** Accounts a reader follows: the fan-in width of one pull-mode feed load. */
export const FOLLOWING = 200;
/** How many of those are celebrities — the merges hybrid pays at read time. */
export const CELEB_FOLLOWED = 5;
/** Audience slider default: 10^3 followers. */
export const DEFAULT_EXP = 3;
/** Audience slider range, in decades. */
const MIN_EXP = 2;
const MAX_EXP = 7;

/** Sample dots per second while the queue drains. VISUAL ONLY — see above. */
const DRAIN_DOTS = 8;
/** Staleness sparkline cadence: 5 samples/sec ⇒ the 80-sample window is ~16s. */
const SAMPLE_INTERVAL = 0.2;
const WRITE_EDGES = ["w1", "w2", "w3"] as const;
const TL_NODES = ["tl-1", "tl-2", "tl-3"] as const;
/** Reads/sec the posts store is provisioned for — pull mode's pressure gauge. */
const STORE_CAPACITY = 1500;
/** Feed loads/sec the api is provisioned for. */
const API_CAPACITY = 12;
/** Staleness (sim-seconds) past which the fan-out queue shows as degraded. */
const STALE_DEGRADED = 60;
/** A learner's own post costing this much trips the "you are the storm" beat. */
const STORM_WRITES = 100_000;

interface FanoutState {
  /** The fan-out backlog: timeline writes waiting. The aggregate, in one number. */
  queue: ServiceQueue;
  /** Writes charged by the most recent post (followers in push, 1 otherwise). */
  writeCost: number;
  /** Timeline writes actually applied — the drain's receipt. */
  writesApplied: number;
  /** Timeline writes ever enqueued (writesApplied + backlog, always). */
  enqueuedTotal: number;
  postsTotal: number;
  /**
   * Feed loads/sec, smoothed. Read ops/sec is this times the mode's exact
   * per-load width — smoothing the *loads* and multiplying by a constant is
   * far steadier than smoothing 200-read spikes, and it re-prices instantly
   * when the learner flips the mode.
   */
  feedEma: number;
  /** Posts waiting to leave the poster; the value is "was this scripted?". */
  pendingPosts: boolean[];
  /** True while the last charged post came from the timeline, not the learner. */
  lastPostScripted: boolean;
  /**
   * Scripted audience (5M) that outranks the slider — the celebrity beat. The
   * learner takes control back by touching the slider, which clears it.
   */
  audienceOverride: number;
  /** Slider exponent seen last tick; a change is the learner taking over. */
  lastExp: number;
  /** Round-robin cursor over the three fleet edges for sample dots. */
  nextWriteEdge: number;
  sampleAcc: number;
}

function readMode(value: ParamValue | undefined): FanoutMode {
  return value === "pull" || value === "hybrid" ? value : "push";
}

/**
 * Reads one feed load costs, by mode. Push precomputed it (1 lookup); pull
 * merges every followed author on demand; hybrid does the cheap lookup plus a
 * merge of just the celebrity accounts.
 */
function readCostFor(mode: FanoutMode): number {
  if (mode === "pull") return FOLLOWING;
  if (mode === "hybrid") return 1 + CELEB_FOLLOWED;
  return 1;
}

export const fanoutSim: LessonSim<FanoutState> = {
  id: "fanout",

  topology: {
    nodes: [
      // Write path (top): the poster, the api, the fan-out queue, the fleet.
      { id: "poster", kind: "client", label: "poster", x: 95, y: 95 },
      { id: "api", kind: "server", label: "api", x: 300, y: 225 },
      { id: "fanout-q", kind: "queue", label: "fanout-q", x: 490, y: 95 },
      { id: "tl-1", kind: "cache", label: "tl-1", x: 700, y: 70 },
      { id: "tl-2", kind: "cache", label: "tl-2", x: 700, y: 190 },
      { id: "tl-3", kind: "cache", label: "tl-3", x: 700, y: 310 },
      // Read path (bottom): readers, and the store a pull has to merge from.
      { id: "reader", kind: "client", label: "readers", x: 95, y: 355 },
      { id: "posts", kind: "database", label: "posts-db", x: 490, y: 355 },
    ],
    edges: [
      { id: "post", from: "poster", to: "api", curve: 0.25 },
      { id: "enqueue", from: "api", to: "fanout-q", curve: -0.25 },
      { id: "w1", from: "fanout-q", to: "tl-1", curve: -0.15 },
      { id: "w2", from: "fanout-q", to: "tl-2" },
      { id: "w3", from: "fanout-q", to: "tl-3", curve: 0.15 },
      { id: "read", from: "reader", to: "api", curve: -0.25 },
      { id: "tlread", from: "api", to: "tl-2", curve: 0.2 },
      { id: "store", from: "api", to: "posts", curve: 0.25 },
    ],
  },

  params: [
    {
      key: "mode",
      label: "fan-out",
      kind: "select",
      options: [
        { value: "push", label: "push" },
        { value: "pull", label: "pull" },
        { value: "hybrid", label: "hybrid" },
      ],
      // Push by default: the storm has to happen before the fix means anything.
      defaultValue: "push",
    },
    {
      // An exponent, not a count. One notch is a decade — the only honest way
      // to put "a hundred followers" and "ten million" on one control.
      key: "followers",
      label: "10^N followers",
      kind: "slider",
      min: MIN_EXP,
      max: MAX_EXP,
      step: 1,
      defaultValue: DEFAULT_EXP,
    },
    {
      key: "readRate",
      label: "reader rate",
      kind: "slider",
      min: 0,
      max: 10,
      step: 1,
      unit: " feeds/s",
      defaultValue: 3,
    },
    { key: "post", label: "POST", kind: "button", defaultValue: false },
  ],

  init: () => ({
    queue: { depth: 0, acc: 0 },
    writeCost: 0,
    writesApplied: 0,
    enqueuedTotal: 0,
    postsTotal: 0,
    feedEma: 0,
    pendingPosts: [],
    lastPostScripted: false,
    audienceOverride: 0,
    lastExp: DEFAULT_EXP,
    nextWriteEdge: 0,
    sampleAcc: 0,
  }),

  step: (state, dt, params) => {
    const L = state.lesson;
    const mode = readMode(params.mode);
    const readRate = Number(params.readRate);
    const readCost = readCostFor(mode);

    // The audience. The scripted beat hands the poster 5,000,000 followers —
    // not a decade, so it can't come from the slider; moving the slider is how
    // the learner takes the account back.
    const exp = Number(params.followers);
    if (exp !== L.lastExp) {
      L.lastExp = exp;
      L.audienceOverride = 0;
    }
    const followers = L.audienceOverride > 0 ? L.audienceOverride : 10 ** exp;

    // 1. POST (momentary button) — one post from the learner.
    if (params.post === true) {
      params.post = false; // consume the press
      L.pendingPosts.push(false);
    }

    // 2. Launch queued posts: ONE packet per post, whatever it will cost.
    while (L.pendingPosts.length > 0) {
      const sent = spawnPacket(state, "post", "post", {
        speed: 1.6,
        size: 6,
        payload: { followers, scripted: L.pendingPosts[0] },
      });
      if (!sent) break; // pool full — the post waits a tick rather than vanishing
      L.pendingPosts.shift();
    }

    // 3. Readers opening the app.
    const loads = shouldSpawn(state, readRate, dt);
    for (let i = 0; i < loads; i++) {
      spawnPacket(state, "read", "request", { speed: 1.5 });
    }

    // 4. Arrivals.
    let feedLoadsNow = 0;
    for (const p of advancePackets(state, dt)) {
      switch (p.edgeId) {
        case "post": {
          // The post reached the api — and here is the whole lesson, in one
          // branch. Note what does NOT happen in push: `audience` packets.
          const audience = Number(p.payload?.followers ?? followers);
          L.lastPostScripted = p.payload?.scripted === true;
          L.postsTotal += 1;
          if (mode === "push") {
            L.writeCost = audience;
            spawnPacket(state, "enqueue", "fanout", {
              speed: 1.6,
              size: 7,
              payload: { writes: audience },
            });
          } else {
            // pull / hybrid: the post is one row in the posts store. That's it.
            L.writeCost = 1;
            spawnPacket(state, "store", "write", { speed: 1.5 });
          }
          break;
        }
        case "enqueue": {
          // The aggregate lands: `writes` timeline writes, as a number.
          const writes = Number(p.payload?.writes ?? 0);
          L.queue.depth += writes;
          L.enqueuedTotal += writes;
          break;
        }
        case "read":
          if (!p.reverse) {
            feedLoadsNow += 1;
            if (mode === "pull") {
              // ONE dot for a merge of FOLLOWING author feeds — the width is
              // in the meter, not in the packet count.
              spawnPacket(state, "store", "pull", {
                speed: 1.5,
                payload: { answers: true },
              });
            } else {
              spawnPacket(state, "tlread", "hit", {
                speed: 1.6,
                payload: { answers: true },
              });
              if (mode === "hybrid") {
                // …plus the celebrity's posts, merged in at read time.
                spawnPacket(state, "store", "pull", {
                  speed: 1.6,
                  size: 3,
                  payload: { answers: false },
                });
              }
            }
          }
          break;
        case "tlread":
          if (!p.reverse) {
            spawnPacket(state, "tlread", "response", {
              speed: 1.7,
              reverse: true,
              size: 3,
              payload: p.payload,
            });
          } else if (p.payload?.answers === true) {
            spawnPacket(state, "read", "response", {
              speed: 1.6,
              reverse: true,
              size: 3,
            });
          }
          break;
        case "store":
          if (p.type === "pull" && !p.reverse) {
            spawnPacket(state, "store", "response", {
              speed: 1.6,
              reverse: true,
              size: 3,
              payload: p.payload,
            });
          } else if (p.reverse && p.payload?.answers === true) {
            spawnPacket(state, "read", "response", {
              speed: 1.6,
              reverse: true,
              size: 3,
            });
          }
          // A "write" arriving here is the post itself: stored, done, cheap.
          break;
        default:
          break; // w1/w2/w3 sample writes are absorbed by the fleet
      }
    }

    // 5. The fleet applies timeline writes at a fixed capacity.
    let servedNow = 0;
    drainQueue(L.queue, DRAIN_RATE, dt, () => {
      servedNow += 1;
    });
    L.writesApplied += servedNow;

    // Sample dots — a fixed handful per second, never one per write. At this
    // capacity each dot stands for ~250 timeline writes.
    if (L.queue.depth > 0 || servedNow > 0) {
      const dots = shouldSpawn(state, DRAIN_DOTS, dt);
      for (let i = 0; i < dots; i++) {
        const edge = WRITE_EDGES[L.nextWriteEdge % WRITE_EDGES.length];
        L.nextWriteEdge += 1;
        spawnPacket(state, edge, "write", { speed: 1.3, size: 3.5 });
      }
    }

    // 6. Readouts.
    const backlog = L.queue.depth;
    // The number the lesson is about: how far behind the last follower is.
    const staleness = backlog / DRAIN_RATE;
    L.feedEma = emaRate(L.feedEma, feedLoadsNow, dt, 0.8);
    // The read-time bill: measured feed loads × this mode's exact fan-in width.
    const readOps = L.feedEma * readCost;

    const queueNode = state.nodes["fanout-q"];
    // Log fill, because the slider is logarithmic: each decade is a seventh of
    // the bar. A linear bar would be pinned at 100% from 10^4 up and say
    // nothing. The node's built-in queue-depth chip is deliberately left unset
    // — it is sized for two digits and these numbers run to eight; the
    // figure's stage overlay prints the backlog compactly instead.
    queueNode.load = approach(queueNode.load, clamp01(Math.log10(1 + backlog) / 7), 6, dt);
    queueNode.health = staleness > STALE_DEGRADED ? "degraded" : "healthy";

    const fleetBusy = clamp01(servedNow / Math.max(DRAIN_RATE * dt, 1));
    for (const id of TL_NODES) {
      state.nodes[id].load = approach(state.nodes[id].load, fleetBusy, 5, dt);
    }
    state.nodes.posts.load = approach(
      state.nodes.posts.load,
      clamp01(readOps / STORE_CAPACITY),
      4,
      dt,
    );
    state.nodes.api.load = approach(
      state.nodes.api.load,
      clamp01(L.feedEma / API_CAPACITY),
      4,
      dt,
    );

    L.sampleAcc += dt;
    if (L.sampleAcc >= SAMPLE_INTERVAL) {
      L.sampleAcc -= SAMPLE_INTERVAL;
      recordSample(state, "staleness", staleness);
    }

    state.metrics.writeCost = L.writeCost;
    state.metrics.backlog = backlog;
    state.metrics.staleness = staleness;
    state.metrics.readCost = readCost;
    state.metrics.readOps = readOps;
    // Not meters: the stage overlay prints the audience, and `writesApplied`
    // is the drain receipt (writesApplied + backlog === enqueuedTotal).
    state.metrics.followers = followers;
    state.metrics.writesApplied = L.writesApplied;
  },

  timeline: [
    {
      at: 2,
      caption:
        "PUSH: the timeline is built at WRITE time. Every follower gets their own precomputed copy.",
    },
    {
      at: 6,
      caption:
        "Which makes reads almost free — a feed load is one lookup in a timeline that already exists.",
    },
    {
      at: 10,
      caption:
        "A normal-scale post goes out: one write per follower. At 10³ that is 1,000 writes, and a 2,000 writes/s fleet swallows it in half a second.",
      apply: (s) => {
        s.lesson.pendingPosts.push(true);
      },
    },
    {
      at: 15,
      caption:
        "⚡ Now the celebrity: 5,000,000 followers. One tap — and in push mode, five million timeline writes.",
      apply: (s) => {
        s.lesson.audienceOverride = CELEB_FOLLOWERS;
        s.lesson.pendingPosts.push(true);
      },
    },
    {
      at: 18.5,
      caption:
        "Staleness = backlog ÷ 2,000 writes per second. It falls one second per second, so 5M writes means ~42 minutes before the last follower sees the post.",
    },
    {
      at: 23,
      caption:
        "A bigger fleet just moves the wall. Switch FAN-OUT to HYBRID and press POST again.",
    },
    // Gated beats — these wait for the learner, not the clock.
    {
      at: 0,
      when: (_s, params) => params.mode === "pull",
      caption:
        "PULL: posting is one write, always. The bill moved to read time — every feed load now merges 200 author feeds.",
    },
    {
      at: 0,
      when: (_s, params) => params.mode === "hybrid",
      caption:
        "HYBRID: normal accounts stay pushed; the celebrity is pulled. One write per post, a handful of extra reads per feed load.",
    },
    {
      at: 0,
      when: (s) =>
        !s.lesson.lastPostScripted && s.metrics.writeCost >= STORM_WRITES,
      caption:
        "☇ Your post just cost 100,000+ timeline writes. The queue is now the entire system, and every follower is waiting in it.",
    },
  ],

  quiz: [
    {
      // Fires two seconds after the scripted celebrity post lands, with the
      // premise sitting on the meters: writes/post = 5,000,000, backlog deep,
      // staleness in the thousands of seconds.
      id: "fo-write-cost",
      at: 16.5,
      question:
        "A 5,000,000-follower account posts in push mode. How many timeline writes does that one post cost?",
      choices: [
        {
          id: "five-million",
          label: "Five million — one per follower; hybrid exists precisely for accounts like this",
        },
        {
          id: "one",
          label: "One — the post is stored once and everyone reads that copy",
        },
        {
          id: "fleet",
          label: "Three — one per timeline-cache node in the fleet",
        },
      ],
      correctChoiceId: "five-million",
      explain:
        "Push fan-out means the post is copied into every follower's timeline, so the write cost of a post IS its follower count: one tap, five million writes, queued behind a fleet that can apply 2,000 a second. That is ~42 minutes before the last follower sees it — and this is Twitter's actual architecture story. Their fix is the hybrid you're about to try: keep pushing for ordinary accounts, and for the handful of celebrities, write once and merge their posts into each timeline at read time.",
    },
  ],

  meters: [
    {
      metricKey: "writeCost",
      label: "writes / post",
      kind: "counter",
      dangerAbove: STORM_WRITES,
    },
    {
      metricKey: "backlog",
      label: "fan-out backlog",
      kind: "counter",
      dangerAbove: 10_000,
    },
    {
      metricKey: "staleness",
      label: "timeline staleness",
      kind: "sparkline",
      unit: "s",
      decimals: 1,
      dangerAbove: STALE_DEGRADED,
    },
    {
      metricKey: "readCost",
      label: "reads / feed load",
      kind: "counter",
      dangerAbove: 50,
    },
    {
      metricKey: "readOps",
      label: "read ops",
      kind: "counter",
      unit: " /s",
      dangerAbove: STORE_CAPACITY,
    },
  ],

  packetStyles: {
    /** The tap: one packet, whatever it is about to cost. */
    post: { color: "var(--color-accent)", size: 6 },
    /** The whole fan-out job, in one dot. */
    fanout: { color: "var(--color-glow-orange)", size: 7 },
    /** Sample timeline writes — a handful standing in for thousands. */
    write: { color: "var(--color-glow-orange)", size: 3.5 },
    /** A read-time merge: cheap-looking, expensive in the meter. */
    pull: { color: "var(--color-glow-cyan)" },
  },
};
