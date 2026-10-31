import { createRunner } from "@/engine/runner";
import { tlsHandshakeSim } from "@/lessons/caching-and-security/tls-handshake";
import { describe, expect, it } from "vitest";

describe("tls-handshake · 1-RTT ECDHE setup latency", () => {
  it("completes full handshake in exactly 1 RTT (~300ms)", () => {
    const r = createRunner(tlsHandshakeSim, {
      seed: 42,
      params: { mode: "full-1rtt" },
    });

    while (r.state.t < 2.0) r.tick();

    // Page: "Setup completes in exactly 1 RTT (300ms)"
    expect(r.state.metrics.handshakeMs).toBe(300);
    expect(r.state.metrics.roundTrips).toBe(1);
    expect(r.state.metrics.replaysBlocked).toBe(0);
  });
});

describe("tls-handshake · 0-RTT PSK resumption", () => {
  it("achieves 0 RTT setup latency and transmits early data immediately", () => {
    const r = createRunner(tlsHandshakeSim, {
      seed: 42,
      params: { mode: "resumed-0rtt", replayAttack: false },
    });

    while (r.state.t < 2.0) r.tick();

    // Page: "setup round trips drop to 0 RTT (0ms)"
    expect(r.state.metrics.handshakeMs).toBe(0);
    expect(r.state.metrics.roundTrips).toBe(0);
    expect(r.state.metrics.replaysBlocked).toBe(0);
    expect(r.state.metrics.earlyDataExecuted).toBe(1);
  });

  it("vulnerable without anti-replay: replayed early data executes twice", () => {
    const r = createRunner(tlsHandshakeSim, {
      seed: 42,
      params: { mode: "resumed-0rtt", replayAttack: true, antiReplay: false },
    });

    while (r.state.t < 2.0) r.tick();

    // Page: "forcing the origin to execute the request twice (replay vulnerability)"
    expect(r.state.metrics.replaysBlocked).toBe(0);
    expect(r.state.metrics.earlyDataExecuted).toBe(2);
  });

  it("protected with anti-replay: server detects duplicate ticket and rejects replayed flight", () => {
    const r = createRunner(tlsHandshakeSim, {
      seed: 42,
      params: { mode: "resumed-0rtt", replayAttack: true, antiReplay: true },
    });

    while (r.state.t < 2.0) r.tick();

    // Page: "detecting and blocking duplicate early data"
    expect(r.state.metrics.replaysBlocked).toBe(1);
    expect(r.state.metrics.earlyDataExecuted).toBe(1);
  });

  it("anti-replay protection persists and blocks replays across multiple sessions", () => {
    const r = createRunner(tlsHandshakeSim, {
      seed: 42,
      params: { mode: "resumed-0rtt", replayAttack: true, antiReplay: true },
    });

    // Run across multiple session cycles
    while (r.state.t < 4.0) r.tick();

    expect(r.state.metrics.replaysBlocked).toBe(2);
    expect(r.state.metrics.earlyDataExecuted).toBe(2);
  });
});
