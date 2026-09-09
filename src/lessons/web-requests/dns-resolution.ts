import {
  advancePackets,
  approach,
  clamp01,
  emaEvent,
  isAlive,
  shouldSpawn,
  spawnPacket,
} from "@/engine/sim-helpers";
import type { LessonSim } from "@/engine/types";

/**
 * DNS Resolution — archetype A (the packet engine).
 *
 * A URL is a name, not an address. Before a browser can open a connection it
 * has to turn `shop.example.com` into an IP, and that translation is itself a
 * little distributed lookup: the browser asks a recursive RESOLVER, and on a
 * cold name the resolver walks the hierarchy — root server, then the TLD
 * server for `.com`, then the AUTHORITATIVE server for `example.com` — one
 * sequential round trip each before it has an answer to hand back.
 *
 * The whole lesson is the difference between that cold walk and a warm hit:
 *   - COLD: browser → resolver, then resolver → root → tld → auth and back,
 *     then resolver → browser. Four legs of round trip stacked end to end.
 *   - WARM: the resolver already holds the answer inside its TTL, so it is one
 *     short round trip — browser → resolver → browser — and the hierarchy
 *     never hears about it. That is why DNS at scale is survivable at all: the
 *     authoritative servers see a trickle, not the flood the browsers generate.
 *
 * The TTL is the size of the cached answer's lease. Drag it down and the
 * resolver re-walks more often (fresher records, more work); drag it up and
 * the hierarchy goes quiet (less work, but a changed record takes longer to
 * propagate). Kill the authoritative server and warm names keep resolving
 * until their TTLs lapse — then the re-walk finds nobody home and fails,
 * exactly the CDN-style grace period, region by region.
 *
 * Latency is MEASURED, not asserted: every query packet carries the sim time
 * the browser sent it, and the round trip is stamped on the answer's arrival.
 * So the meters are a consequence of the geography (the leg speeds below),
 * never a hand-authored number.
 */

/** The names the browser looks up — one small zone catalogue. */
const NAMES = 3;

/**
 * Leg speeds, in progress-units per sim-second. The browser↔resolver hop is
 * short and quick; each hierarchy leg is a full second each way, so a cold
 * walk (root, then tld, then auth) stacks three of them on top of the local
 * hop. "Close" and "far" are things you watch, not read.
 *
 *   local hop   0.42s each way  →  the warm-hit round trip
 *   hierarchy   1.00s each way  →  one referral leg of the cold walk
 */
const HOP_SPEED = 2.4;
const TIER_SPEED = 1.0;
/** Refusals come back fast — an error is cheap to deliver. */
const DROP_SPEED = 1.6;
/** Sim-seconds → the millisecond figure the chips and meters show. */
const MS_PER_SEC = 100;

/** ±6% on every TTL, so nothing in the cache expires in perfect lockstep. */
const TTL_JITTER = 0.06;

/** Per-event EMA rates — both MUST stay under 1 (see `emaEvent`). */
const HIT_EMA_RATE = 0.05;
const LAT_EMA_RATE = 0.18;

/** Authoritative queries/sec that reads as a fully-loaded auth server. */
const AUTH_FULL = 6;

const BROWSER = "browser";
const RESOLVER = "resolver";
const ROOT = "root";
const TLD = "tld";
const AUTH = "auth";

/** browser ↔ resolver (short). */
const LOCAL_EDGE = "local";
/** resolver ↔ each hierarchy tier (long). */
const ROOT_EDGE = "to-root";
const TLD_EDGE = "to-tld";
const AUTH_EDGE = "to-auth";

/** The tiers a cold walk visits, in order. */
const TIERS = [
  { edge: ROOT_EDGE, node: ROOT },
  { edge: TLD_EDGE, node: TLD },
  { edge: AUTH_EDGE, node: AUTH },
] as const;

/** A browser query parked at the resolver while this name is being walked. */
interface Waiter {
  name: number;
  /** Sim time the browser sent it — the clock the latency sample is taken on. */
  t0: number;
}

interface DnsResolutionState {
  /** Per name: sim time this cached record goes stale. 0 = not held / lapsed. */
  expiresAt: number[];
  /** Per name: a walk is already in flight (collapsed forwarding). */
  walking: boolean[];
  /** Browser queries waiting on an in-flight walk, by name. */
  waiting: Waiter[];
  /** Smoothed cache hit ratio, 0..1. */
  hitEma: number;
  /** Smoothed browser-observed lookup latency, ms. */
  lat: number;
  /** Smoothed authoritative queries/sec. */
  authRps: number;
  /** Cumulative failed lookups (auth was gone when the walk arrived). */
  errors: number;
}

export interface DnsResolverMeta {
  /** How many of the catalogue's names are currently cached & fresh. */
  cached: number;
  /** Sim-seconds until the freshest cached record lapses. */
  freshFor: number;
  /** freshFor as a fraction of the current TTL — the pill's drain bar. */
  freshFrac: number;
}

const POP_TIP = 13;
const AUTH_KILL_AT = 18;
const AUTH_REVIVE_AT = 25;
const QUIZ_AT = 18.5;

export const dnsResolutionSim: LessonSim<DnsResolutionState> = {
  id: "dns-resolution",

  topology: {
    nodes: [
      { id: BROWSER, kind: "client", label: "browser", x: 96, y: 200 },
      { id: RESOLVER, kind: "cache", label: "resolver", x: 320, y: 200, breakable: true },
      { id: ROOT, kind: "server", label: "root", x: 660, y: 80 },
      { id: TLD, kind: "server", label: "tld .com", x: 660, y: 200 },
      { id: AUTH, kind: "server", label: "authoritative", x: 660, y: 320, breakable: true },
    ],
    edges: [
      { id: LOCAL_EDGE, from: BROWSER, to: RESOLVER },
      { id: ROOT_EDGE, from: RESOLVER, to: ROOT, curve: -0.18 },
      { id: TLD_EDGE, from: RESOLVER, to: TLD },
      { id: AUTH_EDGE, from: RESOLVER, to: AUTH, curve: 0.18 },
    ],
  },

  params: [
    {
      key: "ttl",
      label: "record ttl",
      kind: "slider",
      min: 2,
      max: 20,
      step: 1,
      unit: "s",
      defaultValue: 8,
    },
    {
      key: "rate",
      label: "lookups",
      kind: "slider",
      min: 1,
      max: 8,
      step: 1,
      unit: " /s",
      defaultValue: 4,
    },
  ],

  init: () => ({
    expiresAt: new Array<number>(NAMES).fill(0),
    walking: new Array<boolean>(NAMES).fill(false),
    waiting: [],
    hitEma: 0,
    lat: 320,
    authRps: 0,
    errors: 0,
  }),

  step: (state, dt, params) => {
    const L = state.lesson;
    const ttl = Number(params.ttl);
    const rate = Number(params.rate);
    const resolverUp = isAlive(state, RESOLVER);
    const authUp = isAlive(state, AUTH);
    let authArrivals = 0;

    // 0. A dead resolver has lost its cache. Requests parked there are dropped
    //    where they stood — a stub resolver with no recursive server to ask.
    if (!resolverUp) {
      L.expiresAt.fill(0);
      L.walking.fill(false);
      if (L.waiting.length > 0) {
        L.errors += L.waiting.length;
        L.waiting = [];
      }
    }

    // 1. The browser generates lookups for names in the catalogue.
    const spawns = shouldSpawn(state, rate, dt);
    for (let i = 0; i < spawns; i++) {
      const name = Math.floor(state.rng() * NAMES);
      spawnPacket(state, LOCAL_EDGE, "request", {
        speed: HOP_SPEED,
        payload: { name, t0: state.t },
      });
    }

    // 2. Deliveries.
    for (const p of advancePackets(state, dt)) {
      const name = Number(p.payload?.name ?? 0);
      const t0 = Number(p.payload?.t0 ?? p.bornAt);

      if (p.edgeId === LOCAL_EDGE) {
        if (p.type === "request") {
          // A browser query reached the resolver.
          if (!resolverUp) {
            L.errors += 1;
            spawnPacket(state, LOCAL_EDGE, "drop", {
              speed: DROP_SPEED,
              reverse: true,
              size: 3,
            });
          } else if (L.expiresAt[name] > state.t) {
            // Warm: the resolver holds a fresh answer. One short round trip.
            L.hitEma = emaEvent(L.hitEma, true, HIT_EMA_RATE);
            spawnPacket(state, LOCAL_EDGE, "hit", {
              speed: HOP_SPEED,
              reverse: true,
              payload: { name, t0 },
            });
          } else {
            // Cold or stale: park it and start the walk once per name.
            L.hitEma = emaEvent(L.hitEma, false, HIT_EMA_RATE);
            L.waiting.push({ name, t0 });
            if (!L.walking[name]) {
              L.walking[name] = true;
              spawnPacket(state, ROOT_EDGE, "query", {
                speed: TIER_SPEED,
                payload: { name, tier: 0 },
              });
            }
          }
        } else if (p.type === "hit" || p.type === "response") {
          // Home. The round trip it actually took is the latency sample.
          L.lat = emaEvent(L.lat, (state.t - t0) * MS_PER_SEC, LAT_EMA_RATE);
        }
        // A "drop" reaching the browser was already counted.
      } else {
        // A hierarchy leg: the packet is on the resolver↔tier link.
        const tierIndex = Number(p.payload?.tier ?? 0);
        if (p.type === "query") {
          // Reached a tier server (root/tld/auth). This tier is the auth only
          // for the last hop; the earlier tiers always answer a referral.
          const isAuthLeg = TIERS[tierIndex].node === AUTH;
          if (isAuthLeg) {
            authArrivals += 1;
            if (!authUp) {
              // The zone's authority is gone: the walk fails. Everyone waiting
              // on this name fails together, and the resolver caches nothing.
              const failed = L.waiting.filter((w) => w.name === name).length;
              L.waiting = L.waiting.filter((w) => w.name !== name);
              L.walking[name] = false;
              L.errors += failed;
              spawnPacket(state, AUTH_EDGE, "drop", {
                speed: DROP_SPEED,
                reverse: true,
                size: 3,
                payload: { name, n: failed },
              });
              continue;
            }
          }
          // Referral (root/tld) or the answer (auth): comes back to resolver.
          spawnPacket(state, TIERS[tierIndex].edge, "referral", {
            speed: TIER_SPEED,
            reverse: true,
            payload: { name, tier: tierIndex },
          });
        } else if (p.type === "referral") {
          const nextTier = tierIndex + 1;
          if (nextTier < TIERS.length) {
            // Root pointed at the TLD, or the TLD at the authoritative: the
            // resolver asks the next tier down. This is the sequential walk.
            spawnPacket(state, TIERS[nextTier].edge, "query", {
              speed: TIER_SPEED,
              payload: { name, tier: nextTier },
            });
          } else {
            // The authoritative answer landed. Cache it under a TTL lease and
            // answer everyone who was waiting on this name.
            L.walking[name] = false;
            L.expiresAt[name] =
              state.t + ttl * (1 + (state.rng() * 2 - 1) * TTL_JITTER);
            for (const w of L.waiting) {
              if (w.name !== name) continue;
              spawnPacket(state, LOCAL_EDGE, "response", {
                speed: HOP_SPEED,
                reverse: true,
                payload: { name, t0: w.t0 },
              });
            }
            L.waiting = L.waiting.filter((w) => w.name !== name);
          }
        } else if (p.type === "drop") {
          // A failed walk reached the resolver; tell the people who asked.
          const n = Math.min(Number(p.payload?.n ?? 1), 3);
          for (let i = 0; i < n; i++) {
            spawnPacket(state, LOCAL_EDGE, "drop", {
              speed: DROP_SPEED,
              reverse: true,
              size: 3,
            });
          }
        }
      }
    }

    // 3. Readouts. The resolver's load bar is how much of the catalogue it
    //    holds fresh; the pill above it is how long its freshest lease has.
    let cached = 0;
    let freshFor = 0;
    for (const expiresAt of L.expiresAt) {
      if (expiresAt > state.t) {
        cached += 1;
        freshFor = Math.max(freshFor, expiresAt - state.t);
      }
    }
    const resolver = state.nodes[RESOLVER];
    resolver.load = resolverUp
      ? approach(resolver.load, clamp01(cached / NAMES), 6, dt)
      : 0;
    const resolverMeta: DnsResolverMeta = {
      cached: resolverUp ? cached : 0,
      freshFor: resolverUp ? freshFor : 0,
      freshFrac: resolverUp ? clamp01(freshFor / Math.max(ttl, 1)) : 0,
    };
    resolver.meta = { ...resolverMeta };

    L.authRps = approach(L.authRps, authArrivals / dt, 4, dt);
    const auth = state.nodes[AUTH];
    auth.load = authUp ? approach(auth.load, clamp01(L.authRps / AUTH_FULL), 4, dt) : 0;

    state.metrics.hitRatio = L.hitEma * 100;
    state.metrics.lookupMs = L.lat;
    state.metrics.authRps = L.authRps;
    state.metrics.errors = L.errors;
  },

  timeline: [
    {
      at: 1.5,
      caption:
        "Cold cache: each new name walks the hierarchy — root, then .com, then the authoritative server — before the browser gets an address.",
    },
    {
      at: 7,
      caption:
        "Warm. Repeat names are answered by the resolver in one short hop, and the hierarchy goes quiet — watch the auth meter fall.",
    },
    {
      at: POP_TIP,
      caption:
        "Drag RECORD TTL down and the resolver re-walks more often: fresher records, but more load on the authoritative server.",
    },
    {
      at: AUTH_KILL_AT,
      caption:
        "☠ The authoritative server is down. Look at the meters: nothing changes — every fresh name is still answered from cache.",
      apply: (s) => {
        s.nodes[AUTH].health = "dead";
        s.nodes[AUTH].load = 0;
      },
    },
    {
      at: QUIZ_AT + 0.5,
      caption:
        "Now the leases run out one by one. Each lapsed name re-walks, reaches nobody, and only then does the lookup fail.",
      when: (s) => !isAlive(s, AUTH),
    },
    {
      at: QUIZ_AT + 2.5,
      caption:
        "A longer TTL would have held longer — and served a stale address the whole time. TTL is the size of the loan.",
      when: (s) => s.lesson.errors > 4,
    },
    {
      at: AUTH_REVIVE_AT,
      caption:
        "The authoritative server is back. The next walk for each name succeeds and refills the cache.",
      apply: (s) => {
        s.nodes[AUTH].health = "healthy";
      },
    },
  ],

  quiz: [
    {
      id: "dns-auth-down",
      at: QUIZ_AT,
      question:
        "The authoritative server for the zone just went down. What do browsers see right now?",
      choices: [
        {
          id: "cached",
          label:
            "Mostly nothing — cached names keep resolving until their TTLs expire.",
        },
        {
          id: "errors",
          label: "Lookups fail immediately — the authoritative server is the only source.",
        },
        { id: "slow", label: "Every lookup slows down while it waits on the authority." },
      ],
      correctChoiceId: "cached",
      explain:
        "A resolver cache is a shield made of copies with a lease. While a name's record is still inside its TTL the resolver answers without asking the hierarchy anything, so the instant the authoritative server dies nothing changes for names already cached. Then, name by name, each TTL lapses, the resolver re-walks, finds nobody home, and only then does that name start failing. The TTL you chose is exactly how long that grace period lasts — and how stale an answer you were willing to serve to get it.",
    },
  ],

  meters: [
    {
      metricKey: "hitRatio",
      label: "cache hit ratio",
      kind: "gauge",
      max: 100,
      unit: "%",
      dangerBelow: 30,
    },
    {
      metricKey: "lookupMs",
      label: "lookup latency",
      kind: "counter",
      unit: "ms",
      dangerAbove: 250,
    },
    {
      metricKey: "authRps",
      label: "authoritative",
      kind: "counter",
      unit: "q/s",
      decimals: 1,
    },
    {
      metricKey: "errors",
      label: "failed lookups",
      kind: "counter",
      dangerAbove: 0,
    },
  ],

  packetStyles: {
    /** A referral or the final answer flowing back down the hierarchy. */
    referral: { color: "var(--color-glow-violet)" },
    /** A resolver→tier query walking the hierarchy. */
    query: { color: "var(--color-glow-cyan)" },
  },

  packetLegend: [
    { type: "request", label: "browser lookup" },
    { type: "query", label: "resolver walks the hierarchy" },
    { type: "referral", label: "referral / answer" },
    { type: "hit", label: "cache hit" },
    { type: "response", label: "resolved address" },
    { type: "drop", label: "lookup failed" },
  ],
};
