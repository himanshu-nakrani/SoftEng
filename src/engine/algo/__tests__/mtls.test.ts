import { buildAlgoSteps } from "@/engine/algo/build";
import { MTLS_COUNTERS as C, clientCert, runMtls } from "@/engine/algo/mtls";
import type { AlgoDef } from "@/engine/algo/types";
import type { MtlsState } from "@/engine/algo/views/mtls";
import { MtlsView } from "@/engine/algo/views/MtlsView";
import type { ComponentType } from "react";
import { describe, expect, it } from "vitest";

const last = (trust: "perimeter" | "mtls", size: number) => runMtls(trust, size).at(-1)!;

describe("runMtls", () => {
  it("perimeter connects with no client cert", () => {
    expect(clientCert(1)).toBe("none");
    const { counters, state } = last("perimeter", 1);
    expect(counters[C.connected]).toBe(1);
    expect(counters[C.verified] ?? 0).toBe(0);
    expect(state.connected).toBe(true);
  });

  it("mTLS connects only with a cert from this CA", () => {
    expect(last("mtls", 0).counters[C.connected]).toBe(1);
    expect(last("mtls", 0).counters[C.verified]).toBe(1);
    expect(last("mtls", 1).counters[C.connected] ?? 0).toBe(0);
    expect(last("mtls", 1).counters[C.rejected]).toBe(1);
    expect(last("mtls", 2).counters[C.rejected]).toBe(1);
    expect(last("mtls", 2).state.connected).toBe(false);
  });

  it("never aliases", () => {
    const steps = runMtls("mtls", 1);
    expect(new Set(steps.map((s) => s.state)).size).toBe(steps.length);
  });
});

describe("mtls rides on archetype B", () => {
  const def: AlgoDef<MtlsState, number> = {
    id: "mtls",
    title: "mtls",
    code: ["server cert", "client cert", "verify", "reject"],
    counters: [{ key: C.connected, label: "connected" }],
    size: { label: "client cert", min: 0, max: 2, default: 0 },
    generateInput: (_rng, size) => size,
    run: (size) => runMtls("mtls", size),
  };

  it("size changes the client cert and the view contract holds", () => {
    expect(buildAlgoSteps(def, 0, 1)).not.toEqual(buildAlgoSteps(def, 1, 1));
    const view: ComponentType<{ state: MtlsState }> = MtlsView;
    expect(view).toBe(MtlsView);
  });
});
