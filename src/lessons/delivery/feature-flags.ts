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
 * Feature Flags — archetype A (the packet engine).
 *
 * Model. One fleet, one build. Every server in the fleet carries BOTH code
 * paths at once — the old one (clean) and the new one (bad: it errors on a
 * fixed, high fraction of the requests that reach it). Nothing is deployed
 * during the lesson; the build never changes. A `flag` control decides, per
 * request, which path that request runs: `off` sends every request down the
 * old path, `on` sends every request down the new path, and `on for beta`
 * sends only the requests belonging to a labelled cohort (the beta group) down
 * the new path and leaves everyone else on the old one. Each arriving request
 * is independently labelled `beta` with probability `betaShare` on `state.rng`,
 * so the cohort is a real, stable attribute of the request rather than a random
 * per-tick coin flip. The `kill flag` button snaps the flag back to `off`: it
 * is the whole point of the flag, a runtime value you flip in place with no
 * deploy, so the new path stops being taken on the very next request.
 *
 * Limits (a believable model, not a faithful one). The two paths here are
 * loud and stateless: the new path fails IMMEDIATELY and independently on each
 * request it runs, with no shared state, no partial writes, and no interaction
 * between the two paths. That is exactly the fault a flag flip can undo
 * cleanly, and it is the easy case. The failures a flag flip CANNOT undo — a
 * new path that has already written data in a shape the old path cannot read,
 * a flag that gates a schema or a cache format rather than a pure code branch —
 * have no representation here, because both paths in this model are
 * independent and side-effect free. The cohort label is also perfectly stable
 * and perfectly observable, which a real user attribute (region, plan, a hash
 * of a user id) usually is not. Those are points the sim cannot make and the
 * closing prose must.
 */

interface FeatureFlagsState {
  /** Requests currently on the new path and not yet answered. */
  newInflight: number;
  /** Requests currently on the old path and not yet answered. */
  oldInflight: number;
  /** Total requests that came back as an error (from either path). */
  errorTotal: number;
  /** Total requests served (any outcome). */
  servedTotal: number;
  /** Smoothed observed error share, 0..1, over completed requests. */
  errorRate: number;
  /** Smoothed share of completed requests that ran the NEW path, 0..1. */
  onNewRate: number;
  /**
   * A flag mode the timeline can force so a passive reader still sees a release
   * happen. Used until the reader touches the flag control, then it yields.
   */
  scriptedFlag: FlagMode | null;
  /** Latches once the reader moves the flag control; scripted flag then stops. */
  readerTookOver: boolean;
}

type FlagMode = "off" | "on" | "beta";

/** The new code path errors on this fraction of the requests it runs. Fixed:
 *  the lesson is about the FLAG, not about how bad the new path is. */
const NEW_FAIL = 0.7;
/** The old path is not perfect — real baselines never are. */
const OLD_FAIL = 0.01;
/** The fraction of requests labelled as the beta cohort. Stable per request. */
const BETA_SHARE = 0.2;

const IN_SPEED = 1.7;
const OUT_SPEED = 1.6;

/** Select default: the flag ships off, so the new path is dark. */
const FLAG_DEFAULT: FlagMode = "off";

/** Does a request in cohort `isBeta` run the new path under flag `mode`? */
function runsNewPath(mode: FlagMode, isBeta: boolean): boolean {
  if (mode === "on") return true;
  if (mode === "beta") return isBeta;
  return false;
}

export const featureFlagsSim: LessonSim<FeatureFlagsState> = {
  id: "feature-flags",

  topology: {
    nodes: [
      { id: "client", kind: "client", label: "traffic", x: 120, y: 225 },
      { id: "lb", kind: "loadbalancer", label: "router", x: 340, y: 225 },
      { id: "old", kind: "server", label: "old path", x: 640, y: 130 },
      { id: "new", kind: "server", label: "new path", x: 640, y: 320, breakable: true },
    ],
    edges: [
      { id: "in", from: "client", to: "lb" },
      { id: "to-old", from: "lb", to: "old", curve: -0.12 },
      { id: "to-new", from: "lb", to: "new", curve: 0.12 },
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
      key: "flag",
      label: "flag",
      kind: "select",
      options: [
        { value: "off", label: "off" },
        { value: "on", label: "on (everyone)" },
        { value: "beta", label: "on for beta" },
      ],
      defaultValue: "off",
    },
    {
      key: "kill",
      label: "kill flag",
      kind: "button",
      defaultValue: false,
    },
  ],

  init: () => ({
    newInflight: 0,
    oldInflight: 0,
    errorTotal: 0,
    servedTotal: 0,
    errorRate: 0,
    onNewRate: 0,
    scriptedFlag: null,
    readerTookOver: false,
  }),

  // `params` is ParamValues (Record<string, ParamValue>), so read through
  // Number()/String() rather than declaring a narrower parameter type — a
  // narrowed type is not assignable to the interface.
  step: (state, dt, params) => {
    const L = state.lesson;
    const rate = Number(params.rate);

    // A "kill flag" press snaps the flag to off. The button is momentary: the
    // engine set it true on press, so consume it and reset it here. Killing the
    // flag also clears any scripted flag the timeline forced.
    if (params.kill === true) {
      params.kill = false;
      params.flag = "off";
      L.scriptedFlag = null;
      L.readerTookOver = true;
    }

    const sliderFlag = String(params.flag) as FlagMode;
    // The scripted beat forces a release so a passive reader sees it happen,
    // but it must YIELD the moment the reader touches the control — otherwise
    // setting the flag back to off would leave the scripted flag contradicting
    // it, the control reading one value and the meter another.
    if (sliderFlag !== FLAG_DEFAULT) L.readerTookOver = true;
    const flag: FlagMode = L.readerTookOver ? sliderFlag : L.scriptedFlag ?? sliderFlag;

    /*
     * The traffic meter shows the share the flag is routing RIGHT NOW, eased so a
     * flip reads as a move — the same treatment blue-green gives `liveOnGreen`.
     *
     * It used to be an EMA over completed responses, which LAGGED: after the flag
     * was killed the meter still read 23% while the control said "off", so the
     * figure appeared to contradict its own switch. `errorRate` is the EMA and
     * carries the lagging view; this one answers "where is traffic going".
     */
    const targetOnNew = flag === "on" ? 1 : flag === "beta" ? BETA_SHARE : 0;
    L.onNewRate = approach(L.onNewRate, targetOnNew, 8, dt);

    // 1. Arrivals at the router. Each request is stamped with a stable cohort
    // label the moment it is born, so "on for beta" targets the same requests
    // every time, not a fresh coin flip at the fork.
    const spawns = shouldSpawn(state, rate, dt);
    for (let i = 0; i < spawns; i++) {
      const isBeta = state.rng() < BETA_SHARE;
      spawnPacket(state, "in", "request", {
        speed: IN_SPEED,
        payload: { beta: isBeta },
      });
    }

    // 2. Deliveries.
    for (const p of advancePackets(state, dt)) {
      if (p.edgeId === "in" && !p.reverse) {
        // At the router — the flag decides which path this request runs. No RNG
        // draw here: the routing is a pure function of the flag and the label
        // this request was born with.
        const isBeta = p.payload?.beta === true;
        const toNew = runsNewPath(flag, isBeta);
        if (toNew) {
          L.newInflight += 1;
          spawnPacket(state, "to-new", "request", {
            speed: OUT_SPEED,
            payload: { beta: isBeta },
          });
        } else {
          L.oldInflight += 1;
          spawnPacket(state, "to-old", "request", {
            speed: OUT_SPEED,
            payload: { beta: isBeta },
          });
        }
      } else if (
        (p.edgeId === "to-new" || p.edgeId === "to-old") &&
        !p.reverse &&
        p.type === "request"
      ) {
        // At a path. A killed new path errors outright; otherwise the path's
        // own failure rate decides. The new path errors most of the time.
        const onNew = p.edgeId === "to-new";
        const node = onNew ? state.nodes.new : state.nodes.old;
        const baseFail = onNew ? NEW_FAIL : OLD_FAIL;
        const failed = node.health === "dead" || state.rng() < baseFail;
        spawnPacket(state, p.edgeId, failed ? "error" : "response", {
          speed: OUT_SPEED,
          reverse: true,
          payload: { onNew },
        });
      } else if (
        (p.edgeId === "to-new" || p.edgeId === "to-old") &&
        p.reverse
      ) {
        // A verdict reached the router — forward it to the client and record
        // it. This is the only place an outcome is counted.
        const onNew = p.edgeId === "to-new";
        if (onNew) L.newInflight = Math.max(0, L.newInflight - 1);
        else L.oldInflight = Math.max(0, L.oldInflight - 1);

        const failed = p.type === "error";
        L.servedTotal += 1;
        if (failed) L.errorTotal += 1;
        L.errorRate = emaEvent(L.errorRate, failed ? 1 : 0, 0.1);

        spawnPacket(state, "in", p.type, { speed: IN_SPEED, reverse: true });
      }
      // A reverse packet on "in" has reached the client — nothing more to do.
    }

    // 3. Load bars: fill with the outstanding calls on each path, so turning
    // the flag on visibly moves work onto the new path.
    state.nodes.old.load = approach(
      state.nodes.old.load,
      clamp01(L.oldInflight / 12),
      6,
      dt,
    );
    state.nodes.new.load = approach(
      state.nodes.new.load,
      clamp01(L.newInflight / 12),
      6,
      dt,
    );

    // 4. Readouts.
    state.metrics.errorRate = L.errorRate * 100;
    state.metrics.onNew = L.onNewRate * 100;
    state.metrics.errors = L.errorTotal;
    state.metrics.served = L.servedTotal;
  },

  timeline: [
    {
      at: 1.5,
      caption:
        "Cyan → requests. Green ← a clean response, red ← an error. The flag is off — every request runs the old path.",
    },
    {
      at: 5,
      caption:
        "The new path is already shipped to the fleet. With the flag off it takes no traffic and does nothing — deployed, but dark.",
    },
    {
      at: 9,
      // Flip the flag ON for everyone — a scripted beat so a passive reader
      // sees the release land with no deploy. The reader can override it with
      // the select (any mode) or KILL FLAG (back to off).
      caption:
        "⚑ Flip the flag on — no deploy, just a runtime value. Every request now runs the new path, and red errors appear at once.",
      apply: (s) => {
        s.lesson.scriptedFlag = "on";
      },
    },
    {
      at: 15,
      /*
       * RELEASE the scripted flag before inviting the reader to try it. A
       * timeline apply cannot write a param (it only receives state), so the
       * scripted flag lives on lesson state and the select cannot follow it.
       * Leaving it engaged would let the control read "off" while the meter
       * read 100% on the new path. Handing control back makes them agree.
       */
      caption:
        "Killed the flag automatically — the new path went dark again in one tick, no rollback deploy. Now set FLAG yourself: try on for beta.",
      apply: (s) => {
        s.lesson.scriptedFlag = null;
      },
    },
    {
      at: 20,
      caption:
        "☠ Click the new path to kill it, or press KILL FLAG to send every request back to the old path in one move.",
    },
  ],

  quiz: [
    {
      id: "feature-flags-decouples-release",
      // Ungated, at t=7.05 — after the "shipped but dark" beat at t=5 and
      // before the flip-on beat at t=9, so no request has run the new path yet
      // (verified headless at seed 42: onNew and errors are both 0 here). The
      // premise "the new code is on every server but nothing is failing" is on
      // screen as the question is asked; the flip it predicts only happens next.
      at: 7.05,
      question:
        "The new path is already on every server, but the flag is off, so it takes no traffic. To release it, you flip the flag on. How much has to be deployed to do that?",
      choices: [
        {
          id: "nothing",
          label: "Nothing — the code is already there; releasing is flipping a runtime value",
        },
        {
          id: "rebuild",
          label: "The whole fleet must be rebuilt and rolled out with the flag on",
        },
        {
          id: "canary",
          label: "A new canary fleet has to be provisioned to carry the new path",
        },
      ],
      correctChoiceId: "nothing",
      explain:
        "The new path shipped with the build, dark. It is on every server already; the flag is the only thing keeping requests off it. Flipping the flag is writing a runtime value — no image is built, nothing is rolled out — so the release happens in seconds, and so does the undo. That is the split the other two methods do not have: a canary and a blue-green deploy both change WHICH build is running, so their rollback is itself a deployment. A flag decouples deploy from release, which is why killing it is instant.",
    },
  ],

  meters: [
    {
      metricKey: "onNew",
      // NOT "flag" — that is the select's label, and the two can hold different
      // values (the scripted beat flips it before the reader touches anything,
      // and "on for beta" reads ~20% here while the control reads a mode name).
      // This says what it measures: the share of served traffic that ran the
      // new path.
      label: "traffic on new path",
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
    /** A request that came back as an error from the new path (or a killed one). */
    error: { color: "var(--color-glow-red)", size: 4 },
  },

  packetLegend: [
    { type: "request", label: "request" },
    { type: "response", label: "clean response" },
    { type: "error", label: "error" },
  ],
};
