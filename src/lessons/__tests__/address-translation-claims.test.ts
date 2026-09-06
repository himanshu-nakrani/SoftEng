import { buildAlgoSteps } from "@/engine/algo/build";
import { PAGING_COUNTERS as C, runPaging } from "@/engine/algo/paging";
import type { AlgoDef } from "@/engine/algo/types";
import type { PagingState } from "@/engine/algo/views/paging";
import {
  addressTranslationAlgo,
  addressTranslationSameTableAlgo,
} from "@/lessons/virtual-memory/address-translation";
import { describe, expect, it } from "vitest";

/**
 * The address-translation lesson states numbers. A failure here means the
 * page now lies, and the message should name the sentence that became untrue.
 */

function run<I>(def: AlgoDef<PagingState, I>, size: number, seed = 42) {
  const steps = buildAlgoSteps(def, size, seed);
  const last = steps[steps.length - 1]!;
  return {
    steps,
    state: last.state,
    counters: last.counters,
    walks: last.counters[C.walks] ?? 0,
    faults: last.counters[C.faults] ?? 0,
  };
}

const identity = (accesses: number[]) =>
  runPaging({
    tlbSize: 0,
    frames: 16,
    replacement: "none",
    demand: false,
    accesses,
  });

describe("address-translation: three translations walk six tables", () => {
  it("VPNs 0, 4, 8 cost six table refs and zero faults", () => {
    // "The table-refs meter stops at 6. Faults stay at 0."
    const c = run(addressTranslationAlgo, 3);
    expect(c.walks).toBe(6);
    expect(c.faults).toBe(0);
    expect(c.state.stamp).toBe("6 walks");
    expect(c.state.last).toEqual({ kind: "walk", vpn: 8 });
  });

  it("the producer agrees on the same three accesses", () => {
    const last = identity([0, 4, 8]).at(-1)!;
    expect(last.counters[C.walks]).toBe(6);
    expect(last.counters[C.faults] ?? 0).toBe(0);
  });

  it("four translations light every directory slot at eight refs", () => {
    // "Drag to 4. ... Eight table refs, and every directory slot has now been walked."
    const c = run(addressTranslationAlgo, 4);
    expect(c.walks).toBe(8);
    expect(c.faults).toBe(0);
    expect(c.state.last).toEqual({ kind: "walk", vpn: 12 });
    expect(c.state.directory.map((d) => d.label)).toEqual([
      "0–3",
      "4–7",
      "8–11",
      "12–15",
    ]);
    expect(c.state.directory[3]!.active).toBe(true);
  });

  it("eight translations cost sixteen refs; VPN 1 still walks", () => {
    // "Drag to 8. Sixteen table refs. VPN 1 still paid two refs even though
    // VPN 0 already walked that table."
    const c = run(addressTranslationAlgo, 8);
    expect(c.walks).toBe(16);
    expect(c.faults).toBe(0);
    expect(c.state.last).toEqual({ kind: "walk", vpn: 13 });
    const vpn1 = c.steps.find((s) => s.state.last?.vpn === 1);
    expect(vpn1?.counters[C.walks]).toBe(10);
    expect(vpn1?.state.last).toEqual({ kind: "walk", vpn: 1 });
  });

  it("walks equal two times the translation count at every slider stop", () => {
    // "Every extra page adds two table refs."
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8]) {
      expect(run(addressTranslationAlgo, n).walks).toBe(2 * n);
      expect(run(addressTranslationSameTableAlgo, n).walks).toBe(2 * n);
    }
  });

  it("every slider position changes the run", () => {
    const hashes = [1, 2, 3, 4, 5, 6, 7, 8].map((n) =>
      JSON.stringify(run(addressTranslationAlgo, n).state.last),
    );
    expect(new Set(hashes).size).toBe(8);
  });

  it("ignores the seed: the walk is not a scheduler", () => {
    expect(buildAlgoSteps(addressTranslationAlgo, 3, 1)).toEqual(
      buildAlgoSteps(addressTranslationAlgo, 3, 99),
    );
  });
});

describe("address-translation: the same table still costs six", () => {
  it("VPNs 0, 1, 2 still cost six table refs", () => {
    // "VPNs 0, 1 and 2 — the same table — still cost six table refs."
    const c = run(addressTranslationSameTableAlgo, 3);
    expect(c.walks).toBe(6);
    expect(c.faults).toBe(0);
    expect(c.state.last).toEqual({ kind: "walk", vpn: 2 });
    expect(c.state.directory[0]!.active).toBe(true);
    expect(c.state.directory.slice(1).every((d) => !d.active)).toBe(true);
  });

  it("four translations in one table are eight refs; eight are sixteen", () => {
    // "Drag to 4, then 8. Eight refs, then sixteen — the same four pages, twice."
    expect(run(addressTranslationSameTableAlgo, 4).walks).toBe(8);
    expect(run(addressTranslationSameTableAlgo, 8)).toMatchObject({
      walks: 16,
      faults: 0,
    });
    expect(run(addressTranslationSameTableAlgo, 8).state.last).toEqual({
      kind: "walk",
      vpn: 3,
    });
  });

  it("across-directory and same-table agree at every size", () => {
    for (const n of [1, 3, 8]) {
      expect(run(addressTranslationAlgo, n).walks).toBe(
        run(addressTranslationSameTableAlgo, n).walks,
      );
    }
  });
});

describe("address-translation: the first frame is untouched", () => {
  it("starts at zero walks with the table not yet walked", () => {
    const { steps } = run(addressTranslationAlgo, 3);
    const first = steps[0]!;
    expect(first.counters[C.walks] ?? 0).toBe(0);
    expect(first.state.table).toEqual([]);
    expect(first.state.stamp).toBe("no walks yet");
    expect(first.state.last).toBeUndefined();
    // Identity map: every directory slot is already present.
    expect(first.state.directory.every((d) => d.present)).toBe(true);
  });

  it("splits VPN 0 / 4 / 8 as directory 0 / 1 / 2, table 0", () => {
    // "VPN 0 reads directory[0] then table[0]; VPN 4 reads directory[1]
    // then table[0]; VPN 8 reads directory[2] then table[0]."
    const notes = run(addressTranslationAlgo, 3).steps.map((s) => s.note);
    expect(notes).toContain("VPN 0: directory[0] then table[0].");
    expect(notes).toContain("VPN 4: directory[1] then table[0].");
    expect(notes).toContain("VPN 8: directory[2] then table[0].");
  });
});
