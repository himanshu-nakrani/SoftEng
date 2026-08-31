import { createRunner } from "@/engine/runner";
import { TICK, type Packet } from "@/engine/types";
import { dnsResolutionSim } from "@/lessons/web-requests/dns-resolution";
import { connectionReuseSim } from "@/lessons/web-requests/connection-reuse";
import { httpRequestResponseSim } from "@/lessons/web-requests/http-request-response";
import { tcpHandshakeSim } from "@/lessons/web-requests/tcp-handshake";
import { describe, expect, it } from "vitest";

/**
 * The networking track's prose states numbers. A failure here means a lesson
 * page now lies, and the message should name the sentence that became untrue.
 *
 * Unlike the archetype-B claim suites, these lessons are packet flows, so the
 * numbers are MEASURED by driving `createRunner` / stepping the sim directly
 * over the seeded run — the same headless core the browser uses.
 *
 * Every claim here has been proven to fail: break the mechanism it pins (drop
 * the sequential walk, remove the TTL cache, keep answering a dead authority)
 * and the matching `expect` goes red.
 */

/**
 * The measured round trip, in ms, of the first lookup of each kind reaching
 * the browser: a cold `response` (walked the hierarchy) and a warm `hit`
 * (answered from cache). Stepped by hand so we can read the packet's own
 * `t0`-stamped latency rather than the smoothed meter.
 */
function firstRoundTrips(seed: number, ttl: number) {
  // ttl high enough that a name's second lookup is still cached, rate low so
  // the two events are cleanly separated in time.
  const r = createRunner(dnsResolutionSim, { seed, params: { ttl, rate: 1 } });
  let cold = 0;
  let warm = 0;
  while (r.state.t < 30 && (cold === 0 || warm === 0)) {
    // Read arrivals off the packets that will complete on THIS tick, before
    // `tick()` consumes them, so the latency is the packet's own stamped t0.
    for (const p of r.state.packets as Packet[]) {
      const willArrive = p.progress + p.speed * TICK >= 1;
      if (!willArrive || p.edgeId !== "local") continue;
      const t0 = Number(p.payload?.t0 ?? p.bornAt);
      const ms = Math.round((r.state.t + TICK - t0) * 100);
      if (p.type === "response" && cold === 0) cold = ms;
      if (p.type === "hit" && warm === 0) warm = ms;
    }
    r.tick();
  }
  return { cold, warm };
}

describe("dns-resolution · a cold walk is ~8x a warm hit", () => {
  it("cold lookup ≈ 700ms, warm hit ≈ 85ms (the page's two figures)", () => {
    // ttl high enough that the second lookup of a name is still cached.
    const { cold, warm } = firstRoundTrips(42, 30);
    // Page: "about 700ms" of stacked round trips.
    expect(cold).toBeGreaterThan(650);
    expect(cold).toBeLessThan(760);
    // Page: "roughly 85ms" for a warm hit.
    expect(warm).toBeGreaterThan(75);
    expect(warm).toBeLessThan(95);
    // Page: "about eight times faster".
    expect(cold / warm).toBeGreaterThan(6);
  });
});

describe("dns-resolution · the cache warms and quiets the hierarchy", () => {
  it("hit ratio climbs above 60% and the authoritative meter falls near zero", () => {
    const r = createRunner(dnsResolutionSim, { seed: 42 });
    // Warm-up window, before the authoritative server is killed at t=18.
    let peakHit = 0;
    let authAfterWarm = Infinity;
    while (r.state.t < 16) {
      r.tick();
      peakHit = Math.max(peakHit, r.state.metrics.hitRatio ?? 0);
      if (r.state.t > 12) authAfterWarm = r.state.metrics.authRps ?? 0;
    }
    // Page: "the hit ratio climbs" — warms well past half once names repeat.
    expect(peakHit).toBeGreaterThan(60);
    // Page: the authoritative meter "falls to almost nothing".
    expect(authAfterWarm).toBeLessThan(1);
  });
});

describe("dns-resolution · a dead authority is survived, then not", () => {
  it("no failures at the moment of death; failures accrue only as TTLs lapse", () => {
    const r = createRunner(dnsResolutionSim, { seed: 42 });
    let errorsAtDeath = -1;
    while (r.state.t < 30) {
      r.tick();
      // The scripted kill lands at t=18; sample just after it.
      if (errorsAtDeath === -1 && r.state.nodes.auth.health === "dead") {
        errorsAtDeath = r.state.metrics.errors ?? 0;
      }
    }
    // Page/quiz: "failures at zero" the instant the authority dies.
    expect(errorsAtDeath).toBe(0);
    // Page: failures accrue "one name at a time" once leases lapse.
    expect(r.state.metrics.errors ?? 0).toBeGreaterThan(10);
  });
});

// ---------------------------------------------------------------------------
// tcp-handshake
// ---------------------------------------------------------------------------

describe("tcp-handshake · a clean handshake is one RTT, first byte is two", () => {
  it("time-to-send ≈ 500ms (1 RTT) and TTFB ≈ 1000ms (2 RTT) at default latency", () => {
    // Default one-way latency is 250ms, so RTT = 500ms. Loss off so nothing
    // retransmits; read before the scripted loss turns on at t=12.
    const r = createRunner(tcpHandshakeSim, { seed: 42, params: { loss: 0 } });
    while (r.state.t < 11) r.tick();
    const setup = r.state.metrics.setupMs ?? 0;
    const ttfb = r.state.metrics.ttfbMs ?? 0;
    // Page: "time to send ... settles at about 500ms, one clean RTT".
    expect(setup).toBeGreaterThan(460);
    expect(setup).toBeLessThan(540);
    // Page: "time to first byte lands near 1000ms: two round trips".
    expect(ttfb).toBeGreaterThan(940);
    expect(ttfb).toBeLessThan(1120);
    // No loss ⇒ nobody retransmits.
    expect(r.state.metrics.retransmits ?? 0).toBe(0);
  });
});

describe("tcp-handshake · a lost setup packet costs an RTO, not an RTT", () => {
  it("scripted loss produces retransmits and a worst first byte past 3000ms", () => {
    // The timeline turns loss on at t=12 for passive viewers; drive the full
    // run and read the tail it creates.
    const r = createRunner(tcpHandshakeSim, { seed: 42 });
    let worstBeforeLoss = 0;
    while (r.state.t < 30) {
      r.tick();
      if (r.state.t < 12) worstBeforeLoss = r.state.metrics.worstMs ?? 0;
    }
    // Page: clean worst first byte is ~1 RTT of setup + 1 RTT data ≈ 1000ms.
    expect(worstBeforeLoss).toBeLessThan(1200);
    // Page: "worst first byte jump past 3000ms" once loss is on — a dropped
    // handshake packet adds a retransmit timeout (RTO ≈ 4 RTT = 2000ms).
    expect(r.state.metrics.retransmits ?? 0).toBeGreaterThan(0);
    expect(r.state.metrics.worstMs ?? 0).toBeGreaterThan(3000);
    // And the average moves far less than the tail: the average TTFB stays
    // well below the worst, which is the "tail, not average" claim.
    expect(r.state.metrics.ttfbMs ?? 0).toBeLessThan(r.state.metrics.worstMs ?? 0);
  });
});

// ---------------------------------------------------------------------------
// http-request-response
// ---------------------------------------------------------------------------

/** First fully-loaded page time, ms, for a given connection count / slow flag. */
function firstPageMs(connections: number, slow = false, seed = 42) {
  const r = createRunner(httpRequestResponseSim, {
    seed,
    params: { connections, slowResource: slow },
  });
  while (r.state.t < 26) {
    r.tick();
    const p = r.state.metrics.lastPageMs ?? 0;
    if (p > 0) return Math.round(p);
  }
  return 0;
}

describe("http-request-response · one connection sums the round trips", () => {
  it("page time falls toward batch/lanes as connections rise", () => {
    const one = firstPageMs(1);
    const three = firstPageMs(3);
    const six = firstPageMs(6);
    // Page: one connection settles "near 4800ms".
    expect(one).toBeGreaterThan(4400);
    expect(one).toBeLessThan(5100);
    // Page: three connections "about 1800ms".
    expect(three).toBeGreaterThan(1550);
    expect(three).toBeLessThan(2050);
    // Page: six connections "about 1200ms".
    expect(six).toBeGreaterThan(1000);
    expect(six).toBeLessThan(1400);
    // The whole point: more lanes is strictly faster (head-of-line removed).
    expect(three).toBeLessThan(one);
    expect(six).toBeLessThan(three);
  });
});

describe("http-request-response · a slow resource blocks a single lane", () => {
  it("one slow resource hurts far more on one connection than on three", () => {
    const oneSlow = firstPageMs(1, true);
    const oneFast = firstPageMs(1, false);
    const threeSlow = firstPageMs(3, true);
    // Page: on a single connection everything behind the slow resource waits.
    expect(oneSlow).toBeGreaterThan(oneFast);
    // Page: "extra connections route around it" — the slow lane is contained.
    expect(threeSlow).toBeLessThan(oneSlow);
  });
});

// ---------------------------------------------------------------------------
// connection-reuse
// ---------------------------------------------------------------------------

/**
 * The measured latency, in ms, of the FIRST and SECOND completed request on
 * each client's lane — read off the latch meter (LAT_EMA_RATE = 1) at the tick
 * the lane's `done` counter increments.
 */
function firstTwoLatencies(reuse: boolean, seed = 7) {
  const r = createRunner(connectionReuseSim, { seed, params: { rate: 1, reuse } });
  const fresh: number[] = [];
  const keep: number[] = [];
  let lastFresh = 0;
  let lastKeep = 0;
  while (r.state.t < 30 && (fresh.length < 2 || keep.length < 2)) {
    r.tick();
    const freshDone = (r.state.nodes.fresh.meta?.done as number) ?? 0;
    const keepDone = (r.state.nodes.keep.meta?.done as number) ?? 0;
    if (freshDone > lastFresh) {
      fresh.push(Math.round(r.state.metrics.freshMs ?? 0));
      lastFresh = freshDone;
    }
    if (keepDone > lastKeep) {
      keep.push(Math.round(r.state.metrics.keepMs ?? 0));
      lastKeep = keepDone;
    }
  }
  return { fresh, keep };
}

describe("connection-reuse · the two clients tie only on the first request", () => {
  it("first request identical (~2 RTT); keep-alive halves the second", () => {
    const { fresh, keep } = firstTwoLatencies(true);
    // Page/quiz: "they take the same time ... about 700ms, two round trips".
    expect(fresh[0]).toBeGreaterThan(620);
    expect(fresh[0]).toBeLessThan(820);
    expect(keep[0]).toBe(fresh[0]);
    // Page: keep-alive's second request "about 350ms", one round trip.
    expect(keep[1]).toBeGreaterThan(300);
    expect(keep[1]).toBeLessThan(430);
    // Page: the new-connection client is "back to around 700ms".
    expect(fresh[1]).toBeGreaterThan(620);
    // Reuse roughly halves the per-request latency after the first.
    expect(keep[1]).toBeLessThan(fresh[1] * 0.7);
  });
});

describe("connection-reuse · turning reuse off makes the lanes converge", () => {
  it("with keep-alive off, the second request costs the same on both", () => {
    const { fresh, keep } = firstTwoLatencies(false);
    // Page: "the two lanes converge, because reuse was the entire difference".
    expect(keep[1]).toBe(fresh[1]);
  });

  it("the new-connection client opens a connection per request; keep-alive stays at one", () => {
    const r = createRunner(connectionReuseSim, { seed: 42, params: { rate: 1, reuse: true } });
    while (r.state.t < 20) r.tick();
    // Page: "one climbs with every request while the other stays at one".
    expect(r.state.metrics.keepOpened ?? 0).toBe(1);
    expect(r.state.metrics.opened ?? 0).toBeGreaterThan(5);
  });
});
