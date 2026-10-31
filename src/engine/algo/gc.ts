import { StepRecorder } from "./recorder";
import type { AlgoStep } from "./types";
import type { GcKind, GcObj, GcState } from "./views/gc";

/**
 * Four tiny collectors over a named heap.
 *
 * Refcount: A→B then drop both frees both. A↔B then drop both leaks
 * both (rc stays 1). Mark-sweep from root 0 marking 0→1 still sweeps
 * an unrooted 2↔3 cycle. Incremental marks 4 live objects in slices
 * of `budget`. Generational minor GC: without a write barrier an
 * old→young pointer loses the young object; with one, a dirty card
 * keeps it.
 *
 * Deliberately absent: a real allocator, tri-colour, remembered sets
 * beyond one card. The argument is what each collector counts.
 */

export const GC_COUNTERS = {
  allocs: "allocs",
  freed: "freed",
  leaked: "leaked",
  marked: "marked",
  swept: "swept",
  lost: "lost",
  pause: "pause",
  slices: "slices",
  cards: "cards",
} as const;

function clone(heap: GcObj[]): GcObj[] {
  return heap.map((o) => ({ ...o }));
}

function snap(
  kind: GcKind,
  heap: GcObj[],
  roots: string[],
  stamp: string,
  cards: string[] = [],
): GcState {
  return { kind, heap: clone(heap), roots: [...roots], cards: [...cards], stamp };
}

export function runRefcount(cyclic: boolean): AlgoStep<GcState>[] {
  const heap: GcObj[] = [];
  const roots: string[] = [];
  let stamp: string = cyclic ? "cycle" : "acyclic";
  const rec = new StepRecorder<GcState>(() => snap("refcount", heap, roots, stamp));

  function obj(id: string): GcObj {
    return heap.find((o) => o.id === id)!;
  }
  function alloc(id: string): void {
    rec.bump(GC_COUNTERS.allocs);
    heap.push({
      id,
      rc: 1,
      ptr: null,
      freed: false,
      lost: false,
      active: true,
    });
    for (const o of heap) o.active = o.id === id;
    rec.record({ codeLine: 0, note: `Alloc ${id} rc=1.` });
  }
  function link(from: string, to: string): void {
    const a = obj(from);
    const b = obj(to);
    if (a.ptr) dropRef(a.ptr);
    a.ptr = to;
    b.rc = (b.rc ?? 0) + 1;
    for (const o of heap) o.active = o.id === from || o.id === to;
    rec.record({ codeLine: 1, note: `${from}.p = ${to}. ${to} rc=${b.rc}.` });
  }
  function dropRef(id: string): void {
    const o = heap.find((x) => x.id === id);
    if (!o || o.freed) return;
    o.rc = (o.rc ?? 0) - 1;
    if (o.rc === 0) {
      rec.bump(GC_COUNTERS.freed);
      o.freed = true;
      o.active = true;
      rec.record({ codeLine: 2, note: `Free ${id}.` });
      if (o.ptr) dropRef(o.ptr);
    }
  }
  function drop(id: string): void {
    for (const o of heap) o.active = o.id === id;
    dropRef(id);
    const o = heap.find((x) => x.id === id);
    rec.record({
      codeLine: 3,
      note: `Drop ${id}. rc=${o?.freed ? 0 : o?.rc ?? 0}.`,
    });
  }

  rec.record({
    note: cyclic ? "Cycle A.p=B, B.p=A." : "A.p=B, then drop both.",
  });
  alloc("A");
  alloc("B");
  link("A", "B");
  if (cyclic) link("B", "A");
  drop("A");
  drop("B");
  const leaked = heap.filter((o) => !o.freed).length;
  if (leaked) rec.bump(GC_COUNTERS.leaked, leaked);
  stamp = leaked ? `${leaked} leaked` : `${rec.count(GC_COUNTERS.freed)} freed`;
  rec.record({
    note: leaked ? `Leaked ${leaked}. rc never hit 0.` : "Both freed.",
  });
  return rec.steps;
}

export function runMarkSweep(size: number): AlgoStep<GcState>[] {
  const cycle = size >= 1;
  const extraRoot = size >= 2;
  const heap: GcObj[] = ["0", "1", "2", "3"].map((id) => ({
    id,
    marked: false,
    ptr: null,
    freed: false,
    lost: false,
    active: false,
  }));
  heap[0]!.ptr = "1";
  if (cycle) {
    heap[2]!.ptr = "3";
    heap[3]!.ptr = "2";
  }
  const roots = extraRoot ? ["0", "2"] : ["0"];
  let stamp: string = "mark";
  const rec = new StepRecorder<GcState>(() => snap("mark", heap, roots, stamp));

  rec.record({
    note: extraRoot
      ? "Roots 0 and 2. Cycle 2↔3 is live."
      : cycle
        ? "Root 0. Cycle 2↔3 is garbage."
        : "Root 0→1. 2 and 3 are garbage.",
  });

  const q = [...roots];
  const seen = new Set<string>();
  while (q.length) {
    const id = q.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const o = heap.find((x) => x.id === id)!;
    o.marked = true;
    o.active = true;
    rec.bump(GC_COUNTERS.marked);
    rec.record({ codeLine: 0, note: `Mark ${id}.` });
    o.active = false;
    if (o.ptr) q.push(o.ptr);
  }

  for (const o of heap) {
    if (!o.marked) {
      o.freed = true;
      o.active = true;
      rec.bump(GC_COUNTERS.swept);
      rec.record({ codeLine: 1, note: `Sweep ${o.id}.` });
      o.active = false;
    }
  }
  stamp = `${rec.count(GC_COUNTERS.marked)} marked ${rec.count(GC_COUNTERS.swept)} swept`;
  rec.record({
    note: `${rec.count(GC_COUNTERS.marked)} marked, ${rec.count(GC_COUNTERS.swept)} swept.`,
  });
  return rec.steps;
}

export function runIncremental(stw: boolean, budget: number): AlgoStep<GcState>[] {
  const ids = ["a", "b", "c", "d"];
  const heap: GcObj[] = ids.map((id, i) => ({
    id,
    marked: false,
    ptr: ids[i + 1] ?? null,
    freed: false,
    lost: false,
    active: false,
  }));
  const roots = ["a"];
  let stamp: string = stw ? "stw" : `budget ${budget}`;
  const rec = new StepRecorder<GcState>(() => snap("incremental", heap, roots, stamp));

  rec.record({
    note: stw ? "Stop-the-world mark of 4." : `Incremental mark, budget ${budget}.`,
  });

  const work = [...ids];
  const slice = stw ? work.length : Math.max(1, budget);
  while (work.length) {
    rec.bump(GC_COUNTERS.slices);
    let n = 0;
    const take = Math.min(slice, work.length);
    for (let k = 0; k < take; k++) {
      const id = work.shift()!;
      const o = heap.find((x) => x.id === id)!;
      o.marked = true;
      o.active = true;
      rec.bump(GC_COUNTERS.marked);
      n += 1;
    }
    if (n > rec.count(GC_COUNTERS.pause)) {
      rec.bump(GC_COUNTERS.pause, n - rec.count(GC_COUNTERS.pause));
    }
    rec.record({
      codeLine: stw ? 0 : 1,
      note: stw ? `Pause ${n}.` : `Slice pause ${n}.`,
    });
    for (const o of heap) o.active = false;
  }
  stamp = stw
    ? `pause ${rec.count(GC_COUNTERS.pause)}`
    : `max ${slice} × ${rec.count(GC_COUNTERS.slices)}`;
  rec.record({
    note: stw
      ? `One pause of ${rec.count(GC_COUNTERS.pause)}.`
      : `${rec.count(GC_COUNTERS.slices)} slices, budget ${slice}.`,
  });
  return rec.steps;
}

export function runGenerational(barrier: boolean, oldToYoung: boolean): AlgoStep<GcState>[] {
  const heap: GcObj[] = [
    { id: "Y0", gen: "young", ptr: null, freed: false, lost: false, active: false },
    { id: "Y1", gen: "young", ptr: null, freed: false, lost: false, active: false },
    { id: "O0", gen: "old", ptr: null, freed: false, lost: false, active: false },
  ];
  const roots = ["Y0", "O0"];
  const cards: string[] = [];
  let stamp: string = barrier ? "barrier" : "no barrier";
  const rec = new StepRecorder<GcState>(() => snap("gen", heap, roots, stamp, cards));

  rec.record({
    note: oldToYoung ? "O0.p = Y1. Minor GC." : "No old-to-young pointer. Minor GC.",
  });

  if (oldToYoung) {
    heap[2]!.ptr = "Y1";
    heap[2]!.active = true;
    heap[1]!.active = true;
    if (barrier) {
      rec.bump(GC_COUNTERS.cards);
      cards.push("O0");
      rec.record({ codeLine: 0, note: "Write barrier dirties card O0." });
    } else {
      rec.record({ codeLine: 0, note: "Store O0.p = Y1. No barrier." });
    }
    for (const o of heap) o.active = false;
  }

  const marked = new Set<string>(["Y0"]);
  if (barrier && cards.includes("O0") && heap[2]!.ptr) marked.add(heap[2]!.ptr);
  for (const id of marked) {
    const o = heap.find((x) => x.id === id)!;
    o.marked = true;
    rec.bump(GC_COUNTERS.marked);
    rec.record({ codeLine: 1, note: `Minor mark ${id}.` });
  }
  for (const o of heap) {
    if (o.gen !== "young") continue;
    if (!o.marked) {
      o.freed = true;
      rec.bump(GC_COUNTERS.swept);
      if (oldToYoung && o.id === "Y1") {
        o.lost = true;
        rec.bump(GC_COUNTERS.lost);
        rec.record({ codeLine: 2, note: `Sweep ${o.id}. Live pointer from old missed.` });
      } else {
        rec.record({ codeLine: 2, note: `Sweep ${o.id}.` });
      }
    }
  }
  stamp = rec.count(GC_COUNTERS.lost)
    ? "lost Y1"
    : rec.count(GC_COUNTERS.swept)
      ? `${rec.count(GC_COUNTERS.swept)} swept`
      : "held";
  rec.record({
    note: rec.count(GC_COUNTERS.lost)
      ? "Y1 was live and got swept."
      : rec.count(GC_COUNTERS.swept)
        ? "Y1 was garbage and got swept."
        : "Young live set held.",
  });
  return rec.steps;
}
