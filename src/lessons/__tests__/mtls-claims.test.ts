import { buildAlgoSteps } from "@/engine/algo/build";
import { MTLS_COUNTERS as C, clientCert, runMtls } from "@/engine/algo/mtls";
import type { AlgoDef } from "@/engine/algo/types";
import type { MtlsState } from "@/engine/algo/views/mtls";
import { mtlsAlgo, mtlsPerimeterAlgo } from "@/lessons/defense-in-depth/mtls";
import { describe, expect, it } from "vitest";

/**
 * The mtls prose states numbers. A failure here means the page now lies,
 * and the message should name the sentence that became untrue.
 *
 * Two peers, svc-a / svc-b. Slider 0/1/2 is ok / none / other-ca.
 * Seed is ignored: a handshake is not a scheduler.
 */

function last<I>(def: AlgoDef<MtlsState, I>, size: number, seed = 42) {
  const steps = buildAlgoSteps(def, size, seed);
  const end = steps[steps.length - 1]!;
  return {
    steps,
    notes: steps.map((s) => s.note),
    state: end.state,
    counters: end.counters,
    connected: end.counters[C.connected] ?? 0,
    verified: end.counters[C.verified] ?? 0,
    rejected: end.counters[C.rejected] ?? 0,
    stamp: end.state.stamp,
  };
}

const SIZES = [0, 1, 2] as const;

describe("mtls · the slider is the client cert, 0 through 2", () => {
  it("maps 0/1/2 to ok/none/other-ca", () => {
    // "The slider is the client cert: 0 is a cert from this CA, 1 is
    // none, 2 is other-ca."
    expect(clientCert(0)).toBe("ok");
    expect(clientCert(1)).toBe("none");
    expect(clientCert(2)).toBe("other-ca");
  });

  it("offers 0 through 2; perimeter defaults to 1, mTLS to 0", () => {
    // "Default 1 is the measured run — no cert, still connected."
    // "Default 0 is the happy path."
    expect(mtlsPerimeterAlgo.id).toBe("mtls-perimeter");
    expect(mtlsAlgo.id).toBe("mtls");
    expect(mtlsPerimeterAlgo.size).toMatchObject({
      min: 0,
      max: 2,
      default: 1,
      label: "client cert",
    });
    expect(mtlsAlgo.size).toMatchObject({
      min: 0,
      max: 2,
      default: 0,
      label: "client cert",
    });
  });

  it("the lesson defs are the same runs as runMtls", () => {
    for (const size of SIZES) {
      expect(buildAlgoSteps(mtlsPerimeterAlgo, size, 42)).toEqual(
        runMtls("perimeter", size),
      );
      expect(buildAlgoSteps(mtlsAlgo, size, 42)).toEqual(runMtls("mtls", size));
    }
  });

  it("ignores the seed: a handshake is not a scheduler", () => {
    for (const size of SIZES) {
      expect(buildAlgoSteps(mtlsPerimeterAlgo, size, 1)).toEqual(
        buildAlgoSteps(mtlsPerimeterAlgo, size, 99),
      );
      expect(buildAlgoSteps(mtlsAlgo, size, 1)).toEqual(
        buildAlgoSteps(mtlsAlgo, size, 99),
      );
    }
  });
});

describe("mtls · perimeter accepts anyone on the network", () => {
  it("size 0, 1, or 2: connected 1, verified 0", () => {
    // "Drag 0 and 2. Every perimeter run ends connected 1, verified 0."
    // "Size 0, 1, or 2: connected 1, verified 0."
    for (const size of SIZES) {
      const run = last(mtlsPerimeterAlgo, size);
      expect(run.connected, `perimeter size ${size} connected`).toBe(1);
      expect(run.verified, `perimeter size ${size} verified`).toBe(0);
      expect(run.rejected, `perimeter size ${size} rejected`).toBe(0);
      expect(run.state.connected).toBe(true);
      expect(run.stamp).toBe("connected");
      expect(run.state.client.name).toBe("svc-a");
      expect(run.state.server.name).toBe("svc-b");
    }
  });

  it("size 1 notes the four perimeter captions, no cert, still connected", () => {
    // "Drag the slider to 1 — no client cert. Step through. The captions
    // read "Perimeter trust. Network is enough.", then "Server presents
    // its cert.", then "Client presents nothing.", then "Perimeter
    // accepts anyone on the network.""
    // "connected is 1. verified is 0. The stamp reads connected."
    const run = last(mtlsPerimeterAlgo, 1);
    expect(run.notes).toEqual([
      "Perimeter trust. Network is enough.",
      "Server presents its cert.",
      "Client presents nothing.",
      "Perimeter accepts anyone on the network.",
    ]);
    expect(run.state.client.cert).toBe("none");
    expect(run.connected).toBe(1);
    expect(run.verified).toBe(0);
    expect(run.stamp).toBe("connected");
  });
});

describe("mtls · mutual TLS checks the client cert", () => {
  it("size 0: connected 1, verified 1, stamp connected", () => {
    // "Leave the slider at 0 — a cert from this CA. connected is 1,
    // verified is 1, the stamp reads connected."
    const run = last(mtlsAlgo, 0);
    expect(run.connected).toBe(1);
    expect(run.verified).toBe(1);
    expect(run.rejected).toBe(0);
    expect(run.stamp).toBe("connected");
    expect(run.state.connected).toBe(true);
    expect(run.state.client.cert).toBe("ok");
    expect(run.notes).toEqual([
      "Mutual TLS handshake.",
      "Server presents its cert.",
      "Client presents a cert from this CA.",
      "Server verifies the client cert.",
    ]);
  });

  it("size 1: connected 0, rejected 1, stamp reject", () => {
    // "Drag to 1. No client cert. connected is 0, rejected is 1, the
    // stamp reads reject."
    const run = last(mtlsAlgo, 1);
    expect(run.connected).toBe(0);
    expect(run.verified).toBe(0);
    expect(run.rejected).toBe(1);
    expect(run.stamp).toBe("reject");
    expect(run.state.connected).toBe(false);
    expect(run.state.client.cert).toBe("none");
    expect(run.notes.at(-1)).toBe("No client cert. Reject.");
  });

  it("size 2: connected 0, rejected 1, stamp reject, not connected", () => {
    // "Drag to 2. A cert from another CA. connected is 0, rejected is 1,
    // the stamp reads reject, and the peers are not connected."
    const run = last(mtlsAlgo, 2);
    expect(run.connected).toBe(0);
    expect(run.verified).toBe(0);
    expect(run.rejected).toBe(1);
    expect(run.stamp).toBe("reject");
    expect(run.state.connected).toBe(false);
    expect(run.state.client.cert).toBe("other-ca");
    expect(run.notes.at(-1)).toBe("Wrong CA. Reject.");
  });
});
