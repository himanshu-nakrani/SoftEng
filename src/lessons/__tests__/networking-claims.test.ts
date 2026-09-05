import { createRunner } from "@/engine/runner";
import { TICK, type Packet } from "@/engine/types";
import { dnsResolutionSim } from "@/lessons/web-requests/dns-resolution";
import { connectionReuseSim } from "@/lessons/web-requests/connection-reuse";
import { httpRequestResponseSim } from "@/lessons/web-requests/http-request-response";
import { tcpHandshakeSim } from "@/lessons/web-requests/tcp-handshake";
import { httpPipeliningHolSim } from "@/lessons/http-protocols/http-pipelining-hol";
import { http2MultiplexingSim } from "@/lessons/http-protocols/http2-multiplexing";
import { http3QuicSim } from "@/lessons/http-protocols/http3-quic";
import { httpCachingSim } from "@/lessons/caching-and-security/http-caching";
import { conditionalRequestsSim } from "@/lessons/caching-and-security/conditional-requests";
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

describe("http-pipelining-hol · FIFO ordering traps completed fast responses", () => {
  it("slow first request produces >700ms peak head-of-line buffering delay", () => {
    const r = createRunner(httpPipeliningHolSim, {
      seed: 42,
      params: { pipelining: true, slowFirst: true, connections: 1 },
    });
    let peakHol = 0;
    while (r.state.t < 4) {
      r.tick();
      peakHol = Math.max(peakHol, r.state.metrics.holDelayMs ?? 0);
    }
    // Page: "accumulating over 730ms of head-of-line delay"
    expect(peakHol).toBeGreaterThan(700);
    expect(peakHol).toBeLessThan(800);
    expect(r.state.metrics.pageMs).toBeGreaterThan(1200);
    expect(r.state.metrics.completed).toBe(4);
  });

  it("uniform processing completely eliminates head-of-line delay", () => {
    const r = createRunner(httpPipeliningHolSim, {
      seed: 42,
      params: { pipelining: true, slowFirst: false, connections: 1 },
    });
    let peakHol = 0;
    while (r.state.t < 4) {
      r.tick();
      peakHol = Math.max(peakHol, r.state.metrics.holDelayMs ?? 0);
    }
    // Page: "HOL delay drops to 0ms and page load finishes in 633ms"
    expect(peakHol).toBe(0);
    expect(r.state.metrics.pageMs).toBe(633);
    expect(r.state.metrics.completed).toBe(4);
  });
});

describe("http2-multiplexing · interleaved frames vs transport head-of-line blocking", () => {
  it("fast stream completes early (733ms) without waiting for heavy stream (1200ms)", () => {
    function getStream5Finish(multiplexing: boolean) {
      const r = createRunner(http2MultiplexingSim, {
        seed: 1,
        params: { multiplexing, lossRate: 0 },
      });
      let finishMs = 0;
      while (r.state.t < 3 && finishMs === 0) {
        for (const p of r.state.packets) {
          if (p.payload?.streamId === 5 && p.payload?.frameIndex === 2 && p.progress >= 0.99) {
            finishMs = Math.round((r.state.t - 0.5) * 1000);
          }
        }
        r.tick();
      }
      return finishMs;
    }

    const multiplexedS5 = getStream5Finish(true);
    const sequentialS5 = getStream5Finish(false);
    // Page: "Stream 5 completes in roughly 733ms"
    expect(multiplexedS5).toBe(733);
    // Page: "under sequential HTTP/1.1 ordering, Stream 5 is starved behind the image, delaying its arrival to 1200ms"
    expect(sequentialS5).toBe(1200);
    expect(multiplexedS5).toBeLessThan(sequentialS5);
  });

  it("packet loss triggers a 600ms TCP transport head-of-line freeze across all streams", () => {
    const rClean = createRunner(http2MultiplexingSim, {
      seed: 1,
      params: { multiplexing: true, lossRate: 0 },
    });
    while (rClean.state.t < 3) rClean.tick();
    expect(rClean.state.metrics.tcpStallMs).toBe(0);
    expect(rClean.state.metrics.pageMs).toBe(1167);

    const rLoss = createRunner(http2MultiplexingSim, {
      seed: 1,
      params: { multiplexing: true, lossRate: 15 },
    });
    while (rLoss.state.t < 3) rLoss.tick();
    // Page: "producing a 600ms transport freeze"
    expect(rLoss.state.metrics.tcpStallMs).toBe(600);
    expect(rLoss.state.metrics.pageMs).toBeGreaterThan(1700);
  });
});

describe("http3-quic · UDP streams eliminate transport head-of-line blocking", () => {
  it("QUIC keeps transport HOL delay at strictly 0ms under packet loss", () => {
    const rQuic = createRunner(http3QuicSim, {
      seed: 1,
      params: { protocol: "http3", lossRate: 15 },
    });
    while (rQuic.state.t < 4) rQuic.tick();
    // Page: "under HTTP/3, it stays pinned at exactly 0ms"
    expect(rQuic.state.metrics.holStallMs).toBe(0);
    // Page: "watch Stream 2 (the script) complete in roughly 833ms despite packet drops"
    expect(rQuic.state.metrics.stream2Ms).toBe(833);
  });

  it("HTTP/2 under the same loss stalls all streams with a 600ms HOL delay", () => {
    const rH2 = createRunner(http3QuicSim, {
      seed: 1,
      params: { protocol: "http2", lossRate: 15 },
    });
    while (rH2.state.t < 4) rH2.tick();
    // Page: "watch a single lost packet freeze all streams, introducing a 600ms HOL stall and delaying Stream 2 to 1100ms or more"
    expect(rH2.state.metrics.holStallMs).toBe(600);
    expect(rH2.state.metrics.stream2Ms).toBeGreaterThanOrEqual(1100);
  });
});

describe("http-caching · max-age and stale-while-revalidate eliminate origin round trips", () => {
  it("max-age raises browser hit rate to 63% and cuts latency from 700ms to 256ms", () => {
    const rNoCache = createRunner(httpCachingSim, {
      seed: 42,
      params: { strategy: "no-cache", ttl: 4 },
    });
    while (rNoCache.state.t < 15) rNoCache.tick();
    // Page: "collapsing hit rate to 0% and inflating average latency back to 700ms"
    expect(rNoCache.state.metrics.hitRate).toBe(0);
    expect(rNoCache.state.metrics.avgLatencyMs).toBe(700);
    expect(rNoCache.state.metrics.originHits).toBe(7);

    const rMaxAge = createRunner(httpCachingSim, {
      seed: 42,
      params: { strategy: "max-age", ttl: 4 },
    });
    while (rMaxAge.state.t < 15) rMaxAge.tick();
    // Page: "browser cache hit rate climbs to 63%, cutting average response latency from 700ms down to 256ms"
    expect(rMaxAge.state.metrics.hitRate).toBe(63);
    expect(rMaxAge.state.metrics.avgLatencyMs).toBe(256);
    expect(rMaxAge.state.metrics.originHits).toBe(3);
  });

  it("stale-while-revalidate serves stale content instantly with 88% hit rate and <60ms latency", () => {
    const rSWR = createRunner(httpCachingSim, {
      seed: 42,
      params: { strategy: "stale-while-revalidate", ttl: 4 },
    });
    while (rSWR.state.t < 15) rSWR.tick();
    // Page: "user-perceived hit rate jump to 88% and average latency drop below 60ms"
    expect(rSWR.state.metrics.hitRate).toBe(88);
    expect(rSWR.state.metrics.avgLatencyMs).toBe(58);
  });
});

describe("conditional-requests · ETags and 304 Not Modified eliminate payload re-downloads", () => {
  it("If-None-Match cuts bandwidth from 300 KB to 51.5 KB with 83% 304 rate", () => {
    const rNaive = createRunner(conditionalRequestsSim, {
      seed: 42,
      params: { useEtags: false, resourceModified: false },
    });
    while (rNaive.state.t < 11) rNaive.tick();
    // Page: "watch unconditional GETs re-download the 50 KB body every time, transferring 300 KB with 0% bandwidth savings"
    expect(rNaive.state.metrics.bytesTransferredKb).toBe(300);
    expect(rNaive.state.metrics.status304Ratio).toBe(0);
    expect(rNaive.state.metrics.bandwidthSavedPct).toBe(0);

    const rEtag = createRunner(conditionalRequestsSim, {
      seed: 42,
      params: { useEtags: true, resourceModified: false },
    });
    while (rEtag.state.t < 11) rEtag.tick();
    // Page: "total data transferred is only 51.5 KB (saving 83% of bandwidth) with an 83% 304 response rate"
    expect(rEtag.state.metrics.bytesTransferredKb).toBe(51.5);
    expect(rEtag.state.metrics.status304Ratio).toBe(83);
    expect(rEtag.state.metrics.bandwidthSavedPct).toBe(83);
  });

  it("modifying origin resource forces 200 OK transfer to update client cache", () => {
    const r = createRunner(conditionalRequestsSim, {
      seed: 42,
      params: { useEtags: true, resourceModified: false },
    });
    while (r.state.t < 3) r.tick();
    expect(r.state.metrics.bytesTransferredKb).toBe(50.3);

    // Origin changes content
    r.setParam("resourceModified", true);
    while (r.state.t < 6) r.tick();
    // Page: "watch the ETag hash mismatch trigger a fresh 200 OK transfer to sync the new version"
    expect(r.state.metrics.bytesTransferredKb).toBe(100.3);
  });
});




