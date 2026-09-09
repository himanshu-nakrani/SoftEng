import {
  advancePackets,
  approach,
  clamp01,
  emaEvent,
  shouldSpawn,
  spawnPacket,
} from "@/engine/sim-helpers";
import type { LessonSim } from "@/engine/types";

/**
 * Canary Releases — archetype A (the packet engine).
 *
 * Model. A load balancer splits incoming requests between two versions of one
 * service: `stable` (the version already in production, which serves cleanly)
 * and `canary` (the version being rolled out, which is bad — it errors on a
 * fixed, high fraction of the calls routed to it). The `canary share` slider is
 * the release control: it is the percentage of traffic the balancer sends to
 * the new version. Each arriving request is independently routed to the canary
 * with probability `share`, so the observed error rate is `share × canaryFail`
 * — set the share to 100% and every user meets the bad version; set it to 5%
 * and only 5% do. The `roll back` button snaps the share to zero, which is the
 * whole point of a canary: a bad release is a slider you can move back.
 *
 * Limits (this is a believable model, not a statistical one). Routing is a
 * per-request coin flip on `state.rng`, so at small shares and short runs the
 * *measured* error rate is a noisy sample of `share × canaryFail`, not that
 * product exactly — which is itself the honest shape of a real canary and the
 * subject of the closing section. There is no queue, no latency, no capacity
 * pressure here: a bad version in this model fails LOUDLY and IMMEDIATELY on
 * the requests it receives. The faults a real canary misses — a bug behind a
 * rare input, a slow resource leak, a failure that only appears at full scale —
 * have no representation in this sim precisely because they never show up in a
 * fraction of the traffic, which is the point the sim cannot make and the prose
 * must.
 */

interface CanaryState {
  /** Requests routed to the canary and not yet answered. */
  canaryInflight: number;
  /** Requests routed to the stable version and not yet answered. */
  stableInflight: number;
  /** Total requests that came back as an error (from either version). */
  errorTotal: number;
  /** Total requests served (any outcome). */
  servedTotal: number;
  /** Smoothed observed error share, 0..1, over the requests that completed. */
  errorRate: number;
  /** Live share the balancer is using; eased toward the slider so a rollback reads as a move. */
  liveShare: number;
  /**
   * A share the timeline can force so a passive reader still sees the release
   * happen. Routing uses `max(sliderShare, scriptedShare)`, so the reader can
   * always push the slider HIGHER; a roll back clears both to zero.
   */
  scriptedShare: number;
  /** Latches once the reader moves the share slider; scripted share then stops. */
  readerTookOver: boolean;
}

/** The bad version errors on this fraction of the calls it receives. Fixed: the
 *  lesson is about the SHARE, not about how bad the version is. */
const CANARY_FAIL = 0.8;
/** The stable version is not perfect — real baselines never are. */
const STABLE_FAIL = 0.01;

const IN_SPEED = 1.7;
const OUT_SPEED = 1.6;

/** Slider default; the scripted share yields as soon as the reader leaves it. */
const SHARE_DEFAULT = 0;

export const canaryReleasesSim: LessonSim<CanaryState> = {
  id: "canary-releases",

  topology: {
    nodes: [
      { id: "client", kind: "client", label: "traffic", x: 120, y: 225 },
      { id: "lb", kind: "loadbalancer", label: "router", x: 360, y: 225 },
      { id: "stable", kind: "server", label: "v1.4", x: 660, y: 130, breakable: true },
      { id: "canary", kind: "server", label: "v1.5", x: 660, y: 320, breakable: true },
    ],
    edges: [
      { id: "in", from: "client", to: "lb" },
      { id: "to-stable", from: "lb", to: "stable", curve: -0.12 },
      { id: "to-canary", from: "lb", to: "canary", curve: 0.12 },
    ],
  },

  params: [
    {
      key: "rate",
      label: "traffic",
      kind: "slider",
      min: 2,
      max: 16,
      step: 1,
      unit: " req/s",
      defaultValue: 10,
    },
    {
      key: "share",
      label: "canary share",
      kind: "slider",
      min: 0,
      max: 100,
      step: 5,
      unit: "%",
      defaultValue: 0,
    },
    {
      key: "rollback",
      label: "roll back",
      kind: "button",
      defaultValue: false,
    },
  ],

  init: () => ({
    canaryInflight: 0,
    stableInflight: 0,
    errorTotal: 0,
    servedTotal: 0,
    errorRate: 0,
    liveShare: 0,
    scriptedShare: 0,
    readerTookOver: false,
  }),

  // `params` is ParamValues (Record<string, ParamValue>), so read through
  // Number()/String() rather than declaring a narrower parameter type — a
  // narrowed type is not assignable to the interface.
  step: (state, dt, params) => {
    const L = state.lesson;
    const rate = Number(params.rate);

    // A "roll back" press sets the share to zero. The button is momentary:
    // the engine set it true on press, so consume it and reset it here. A
    // rollback also clears any scripted share the timeline forced.
    if (params.rollback === true) {
      params.rollback = false;
      params.share = 0;
      L.scriptedShare = 0;
      L.readerTookOver = true;
    }
    const sliderShare = clamp01(Number(params.share) / 100);
    // The effective routing share is whichever is larger: the reader's slider,
    // or a share the timeline scripted. The reader can always push it higher.
    /*
     * The scripted beat opens the release so a passive reader sees it happen,
     * but it must YIELD the moment the reader takes the control. Without this,
     * dragging the slider to 0% left 20% of traffic on the canary and the figure
     * flatly contradicted its own slider.
     */
    if (sliderShare !== SHARE_DEFAULT) L.readerTookOver = true;
    const share = L.readerTookOver ? sliderShare : Math.max(sliderShare, L.scriptedShare);
    // Ease the live share so a rollback reads as a handle sliding home rather
    // than a jump — display only; routing below uses `share` directly.
    L.liveShare = approach(L.liveShare, share, 8, dt);

    // 1. Arrivals at the router.
    const spawns = shouldSpawn(state, rate, dt);
    for (let i = 0; i < spawns; i++) {
      spawnPacket(state, "in", "request", { speed: IN_SPEED });
    }

    // 2. Deliveries.
    for (const p of advancePackets(state, dt)) {
      if (p.edgeId === "in" && !p.reverse) {
        // At the router — split the request. One RNG draw per request decides
        // which version it meets, so the canary really receives `share` of it.
        const toCanary = state.rng() < share;
        if (toCanary) {
          L.canaryInflight += 1;
          spawnPacket(state, "to-canary", "request", { speed: OUT_SPEED });
        } else {
          L.stableInflight += 1;
          spawnPacket(state, "to-stable", "request", { speed: OUT_SPEED });
        }
      } else if (
        (p.edgeId === "to-canary" || p.edgeId === "to-stable") &&
        !p.reverse &&
        p.type === "request"
      ) {
        // At a version. A dead box errors outright; otherwise the version's own
        // failure rate decides. The bad version (v1.5) errors most of the time.
        const canary = p.edgeId === "to-canary";
        const node = canary ? state.nodes.canary : state.nodes.stable;
        const baseFail = canary ? CANARY_FAIL : STABLE_FAIL;
        const failed = node.health === "dead" || state.rng() < baseFail;
        spawnPacket(state, p.edgeId, failed ? "error" : "response", {
          speed: OUT_SPEED,
          reverse: true,
        });
      } else if (
        (p.edgeId === "to-canary" || p.edgeId === "to-stable") &&
        p.reverse
      ) {
        // A verdict reached the router — forward it back to the client and
        // record it. This is the only place an outcome is counted.
        const canary = p.edgeId === "to-canary";
        if (canary) L.canaryInflight = Math.max(0, L.canaryInflight - 1);
        else L.stableInflight = Math.max(0, L.stableInflight - 1);

        const failed = p.type === "error";
        L.servedTotal += 1;
        if (failed) L.errorTotal += 1;
        // Per-request smoothing of the observed error share.
        L.errorRate = emaEvent(L.errorRate, failed ? 1 : 0, 0.1);

        spawnPacket(state, "in", p.type, { speed: IN_SPEED, reverse: true });
      }
      // A reverse packet on "in" has reached the client — nothing more to do.
    }

    // 3. Load bars: fill with the outstanding calls at each version, so a rising
    // canary share visibly moves work onto v1.5.
    state.nodes.stable.load = approach(
      state.nodes.stable.load,
      clamp01(L.stableInflight / 12),
      6,
      dt,
    );
    state.nodes.canary.load = approach(
      state.nodes.canary.load,
      clamp01(L.canaryInflight / 12),
      6,
      dt,
    );

    // 4. Readouts.
    state.metrics.errorRate = L.errorRate * 100;
    state.metrics.errors = L.errorTotal;
    state.metrics.served = L.servedTotal;
    state.metrics.canaryShare = L.liveShare * 100;
  },

  timeline: [
    {
      at: 1.5,
      caption:
        "Cyan → requests. Green ← a clean response, red ← an error. The router splits them.",
    },
    {
      at: 5,
      caption:
        "canary share is 0%: every request goes to v1.4, the version already in production.",
    },
    {
      at: 9,
      // Ship the bad version to a fraction of traffic — a scripted beat so a
      // passive reader still sees the release land. The reader can override it
      // with the slider (higher) or the roll-back button (to zero).
      caption:
        "⚠ Ship v1.5 to 20% of traffic. Red errors appear — but only on the canary path.",
      apply: (s) => {
        s.lesson.scriptedShare = 0.2;
      },
    },
    {
      at: 15,
      caption:
        "Drag CANARY SHARE up and the error rate rises with it. Push it to 100% to see a full-fleet bad deploy.",
    },
    {
      at: 20,
      caption:
        "☠ Click v1.5 to kill it — now every request it gets is an error. Press ROLL BACK to send its traffic home to v1.4.",
    },
  ],

  quiz: [
    {
      id: "canary-share-scales",
      // Ungated, at t=7.05 — well before the ship-it beat at t=9 and before any
      // canary error is visible. At seed 42 with the default share=0, zero
      // requests have reached v1.5 by here (verified headless): the premise
      // "nothing has failed yet" is on screen as the question is asked, and the
      // consequence it predicts only becomes visible once the reader raises the
      // share.
      at: 7.05,
      question:
        "v1.5 is a bad version: it errors on most requests it receives. You are about to route some traffic to it. If you send it 20% of requests instead of 100%, what happens to the overall error rate?",
      choices: [
        {
          id: "fifth",
          label: "Roughly a fifth of the damage — only the canary's share of traffic can fail",
        },
        {
          id: "same",
          label: "The same — a bad version fails every request no matter the share",
        },
        {
          id: "none",
          label: "Nothing fails — splitting traffic cancels the errors out",
        },
      ],
      correctChoiceId: "fifth",
      explain:
        "A request can only meet the bad version if the router sends it there. At a 20% share, ~80% of requests still go to the healthy v1.4 and come back clean; only the ~20% routed to v1.5 are exposed to its errors. So the overall error rate is roughly the canary share times the canary's own failure rate — bounding the blast radius to the fraction you chose is the entire reason to release this way. Raising the share to 100% removes the bound: then every request meets the bad version.",
    },
  ],

  meters: [
    {
      metricKey: "canaryShare",
      // NOT "canary share" — that is the slider's label, and the two can hold
      // different numbers (the scripted beat opens the release before the reader
      // touches anything). Two readouts with one name showing two values reads
      // as a bug, so this one says what it actually measures: the share of
      // traffic the balancer is routing right now.
      label: "traffic on v1.5",
      kind: "bar",
      max: 100,
      unit: "%",
    },
    {
      metricKey: "errorRate",
      label: "error rate",
      kind: "counter",
      unit: "%",
      decimals: 0,
      dangerAbove: 5,
    },
    {
      metricKey: "errors",
      label: "failed requests",
      kind: "counter",
      dangerAbove: 0,
    },
    {
      metricKey: "served",
      label: "requests served",
      kind: "counter",
    },
  ],

  packetStyles: {
    /** A request that came back as an error from a bad version. */
    error: { color: "var(--color-glow-red)", size: 4 },
  },

  packetLegend: [
    { type: "request", label: "request" },
    { type: "response", label: "clean response" },
    { type: "error", label: "error" },
  ],
};
