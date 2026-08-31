import { advancePackets, approach, clamp01, emaEvent, shouldSpawn, spawnPacket } from "@/engine/sim-helpers";
import type { LessonSim } from "@/engine/types";

/**
 * Blue-Green Deploys — archetype A (the packet engine).
 *
 * Model. Two complete fleets sit behind one router: `blue` runs the version
 * already in production (it serves cleanly) and `green` holds the new version
 * (which is bad — it errors on a fixed, high fraction of every request it
 * receives). Unlike a canary, the control is NOT a share: the `deploy` toggle
 * is a switch that sends either 0% or 100% of traffic to green, and every
 * request follows whichever fleet is live at the instant it reaches the router.
 * Flipping the switch to green cuts the whole fleet over at once; the `revert`
 * button flips it straight back to blue. So a bad green version fails 100% of
 * traffic for exactly as long as the switch points at it — recovery is one
 * flip, but the blast radius while it is wrong is everyone.
 *
 * Limits (a believable model, not queueing theory). The cutover here is
 * instantaneous and lossless: real routers drain connections, and requests
 * already in flight to blue when you flip do not teleport to green. There is no
 * queue, no latency, no capacity pressure — green fails LOUDLY and IMMEDIATELY
 * on the requests it receives, so the flip is visible on the very next tick.
 * The failures blue-green is genuinely bad at — a schema migration that both
 * versions must tolerate, state written by green that blue can no longer read
 * after a revert — have no representation in this sim, precisely because the
 * model treats the two fleets as independent and stateless. That is the point
 * the sim cannot make and the closing prose must.
 */

interface BlueGreenState {
  /** Requests routed to green and not yet answered. */
  greenInflight: number;
  /** Requests routed to blue and not yet answered. */
  blueInflight: number;
  /** Total requests that came back as an error. */
  errorTotal: number;
  /** Total requests served (any outcome). */
  servedTotal: number;
  /** Smoothed observed error share, 0..1, over completed requests. */
  errorRate: number;
  /** Live fraction of traffic on green, 0..1, eased so a flip reads as a move. */
  liveOnGreen: number;
  /**
   * Which fleet the timeline has forced live, so a passive reader still sees
   * the cutover happen. Routing uses this until the reader touches the switch.
   */
  scriptedGreen: boolean;
  /** Latches once the reader moves the deploy switch; scripted state then stops. */
  readerTookOver: boolean;
}

/** Green errors on this fraction of the calls it receives. Fixed: the lesson is
 *  about the SWITCH, not about how bad the new version is. */
const GREEN_FAIL = 0.75;
/** Blue is not perfect — real baselines never are. */
const BLUE_FAIL = 0.01;

const IN_SPEED = 1.7;
const OUT_SPEED = 1.6;

/** Toggle default: false = blue live, no traffic on green. */
const DEPLOY_DEFAULT = false;

export const blueGreenSim: LessonSim<BlueGreenState> = {
  id: "blue-green",

  topology: {
    nodes: [
      { id: "client", kind: "client", label: "traffic", x: 120, y: 225 },
      { id: "router", kind: "loadbalancer", label: "router", x: 360, y: 225 },
      { id: "blue", kind: "server", label: "blue v1.4", x: 660, y: 130, breakable: true },
      { id: "green", kind: "server", label: "green v1.5", x: 660, y: 320, breakable: true },
    ],
    edges: [
      { id: "in", from: "client", to: "router" },
      { id: "to-blue", from: "router", to: "blue", curve: -0.12 },
      { id: "to-green", from: "router", to: "green", curve: 0.12 },
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
      key: "deploy",
      label: "cut over to green",
      kind: "toggle",
      defaultValue: false,
    },
    {
      key: "revert",
      label: "revert",
      kind: "button",
      defaultValue: false,
    },
  ],

  init: () => ({
    greenInflight: 0,
    blueInflight: 0,
    errorTotal: 0,
    servedTotal: 0,
    errorRate: 0,
    liveOnGreen: 0,
    scriptedGreen: false,
    readerTookOver: false,
  }),

  // `params` is ParamValues (Record<string, ParamValue>), so read through
  // Number()/String()/=== true rather than declaring a narrower parameter type
  // — a narrowed type is not assignable to the interface.
  step: (state, dt, params) => {
    const L = state.lesson;
    const rate = Number(params.rate);

    // A "revert" press flips the switch back to blue. The button is momentary:
    // the engine set it true on press, so consume it and reset it here. A
    // revert also clears any scripted cutover the timeline forced.
    if (params.revert === true) {
      params.revert = false;
      params.deploy = false;
      L.scriptedGreen = false;
      L.readerTookOver = true;
    }

    const switchGreen = params.deploy === true;
    // The scripted beat cuts over so a passive reader sees it happen, but it
    // must YIELD the moment the reader touches the switch — otherwise flipping
    // the toggle back to blue would leave the scripted cutover contradicting it.
    if (switchGreen !== DEPLOY_DEFAULT) L.readerTookOver = true;
    const liveGreen = L.readerTookOver ? switchGreen : L.scriptedGreen || switchGreen;

    // Ease the live-on-green fraction so a cutover reads as a switch throwing
    // rather than a jump — display only; routing below uses `liveGreen` directly.
    L.liveOnGreen = approach(L.liveOnGreen, liveGreen ? 1 : 0, 8, dt);

    // 1. Arrivals at the router.
    const spawns = shouldSpawn(state, rate, dt);
    for (let i = 0; i < spawns; i++) {
      spawnPacket(state, "in", "request", { speed: IN_SPEED });
    }

    // 2. Deliveries.
    for (const p of advancePackets(state, dt)) {
      if (p.edgeId === "in" && !p.reverse) {
        // At the router — the whole request goes to whichever fleet is live.
        // This is a switch, not a coin flip: no RNG draw, no per-request split.
        if (liveGreen) {
          L.greenInflight += 1;
          spawnPacket(state, "to-green", "request", { speed: OUT_SPEED });
        } else {
          L.blueInflight += 1;
          spawnPacket(state, "to-blue", "request", { speed: OUT_SPEED });
        }
      } else if (
        (p.edgeId === "to-blue" || p.edgeId === "to-green") &&
        !p.reverse &&
        p.type === "request"
      ) {
        // At a fleet. A dead box errors outright; otherwise the fleet's own
        // failure rate decides. Green (v1.5) errors most of the time.
        const green = p.edgeId === "to-green";
        const node = green ? state.nodes.green : state.nodes.blue;
        const baseFail = green ? GREEN_FAIL : BLUE_FAIL;
        const failed = node.health === "dead" || state.rng() < baseFail;
        spawnPacket(state, p.edgeId, failed ? "error" : "response", {
          speed: OUT_SPEED,
          reverse: true,
        });
      } else if ((p.edgeId === "to-blue" || p.edgeId === "to-green") && p.reverse) {
        // A verdict reached the router — forward it to the client and record
        // it. This is the only place an outcome is counted.
        const green = p.edgeId === "to-green";
        if (green) L.greenInflight = Math.max(0, L.greenInflight - 1);
        else L.blueInflight = Math.max(0, L.blueInflight - 1);

        const failed = p.type === "error";
        L.servedTotal += 1;
        if (failed) L.errorTotal += 1;
        L.errorRate = emaEvent(L.errorRate, failed ? 1 : 0, 0.1);

        spawnPacket(state, "in", p.type, { speed: IN_SPEED, reverse: true });
      }
      // A reverse packet on "in" has reached the client — nothing more to do.
    }

    // 3. Load bars: fill with the outstanding calls at each fleet, so a cutover
    // visibly moves all the work from blue to green at once.
    state.nodes.blue.load = approach(state.nodes.blue.load, clamp01(L.blueInflight / 12), 6, dt);
    state.nodes.green.load = approach(state.nodes.green.load, clamp01(L.greenInflight / 12), 6, dt);

    // 4. Readouts.
    state.metrics.errorRate = L.errorRate * 100;
    state.metrics.errors = L.errorTotal;
    state.metrics.served = L.servedTotal;
    state.metrics.liveOnGreen = L.liveOnGreen * 100;
  },

  timeline: [
    {
      at: 1.5,
      caption:
        "Cyan → requests. Green ← a clean response, red ← an error. The router sends all of it to blue.",
    },
    {
      at: 5,
      caption: "Blue v1.4 is live and green v1.5 takes no traffic — a whole idle fleet, already built.",
    },
    {
      at: 9,
      // Cut the whole fleet over to green — a scripted beat so a passive reader
      // sees it land. The reader can flip it back with the toggle or REVERT.
      caption: "⚠ Cut over to green. All traffic moves to v1.5 at once — and every request now errors.",
      apply: (s) => {
        s.lesson.scriptedGreen = true;
      },
    },
    {
      at: 15,
      /*
       * RELEASE the scripted cutover before inviting the reader to try it.
       *
       * A timeline `apply` cannot write a param (it only receives state), so the
       * scripted deploy lives on lesson state and the toggle cannot follow it.
       * Leaving it engaged here meant the switch read OFF while the meter read
       * 100% on green, and this caption told the reader to do something that had
       * already happened. Handing control back makes both readouts agree again.
       */
      caption:
        "Rolled back to blue automatically. Now flip CUT OVER TO GREEN yourself — there is no in-between, it is 0% or 100%.",
      apply: (state) => {
        state.lesson.scriptedGreen = false;
      },
    },
    {
      at: 20,
      caption: "☠ Click a fleet to kill it, or press REVERT to flip straight back to blue in one move.",
    },
  ],

  quiz: [
    {
      id: "cutover-is-all-at-once",
      // Ungated, at t=7.05 — before the scripted cutover at t=9 and before any
      // green error is visible. At seed 42 with deploy=false, zero requests
      // have reached green by here (verified headless): the premise "nothing
      // has failed yet, all traffic is on blue" is on screen as the question is
      // asked, and the failure it predicts only appears once the switch flips.
      at: 7.05,
      question:
        "Green v1.5 is a bad version: it errors on most requests it receives. Right now all traffic is on blue. When you cut over to green, what happens to the error rate?",
      choices: [
        {
          id: "all",
          label: "It jumps to roughly green's own failure rate at once — every request now meets the bad version",
        },
        {
          id: "fraction",
          label: "It rises to a small fraction — the switch only exposes some users at a time",
        },
        {
          id: "gradual",
          label: "It climbs slowly as green warms up and takes over from blue",
        },
      ],
      correctChoiceId: "all",
      explain:
        "The deploy switch is not a share. It sends either all of the traffic or none of it to green, so the instant it flips, every request meets v1.5 and the error rate jumps to essentially green's own failure rate — there is no fraction of users who stayed on blue. That is the trade a blue-green deploy makes: the cutover is one atomic move, but while green is wrong it is wrong for everyone. The revert is just as atomic, which is why recovery is as fast as the mistake.",
    },
  ],

  meters: [
    {
      metricKey: "liveOnGreen",
      // NOT "cut over to green" — that is the toggle's label, and the two can
      // hold different values (the scripted beat cuts over before the reader
      // touches anything). This says what it measures: the share of traffic on
      // green right now, which is 0 or 100 with a brief eased transition.
      label: "traffic on green",
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
    /** A request that came back as an error from a bad fleet. */
    error: { color: "var(--color-glow-red)", size: 4 },
  },

  packetLegend: [
    { type: "request", label: "request" },
    { type: "response", label: "clean response" },
    { type: "error", label: "error" },
  ],
};
