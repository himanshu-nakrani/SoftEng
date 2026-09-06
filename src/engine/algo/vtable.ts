import { StepRecorder } from "./recorder";
import type { AlgoStep } from "./types";
import type { VtableKind, VtableSlot, VtableState } from "./views/vtable";

/**
 * Dispatch toys for archetype B.
 *
 * Static: the call site names the function. 0 lookups.
 * Vtable: load vptr, then slot 0. 2 lookups. Dog → woof, Cat → meow.
 * Itable: load vptr, then scan until the iid matches. lookups = 1 + scans.
 * Slot 0 scans 1 (lookups 2). Slot 2 scans 3 (lookups 4).
 *
 * Deliberately absent: multiple inheritance, fat pointers, inline caches.
 * The argument is how many loads a call takes, counted.
 */

export const VTABLE_COUNTERS = {
  lookups: "lookups",
  scans: "scans",
  calls: "calls",
} as const;

export const VTABLE_OBJECTS = [
  { id: "dog", cls: "Dog", fn: "Dog_speak", result: "woof" },
  { id: "cat", cls: "Cat", fn: "Cat_speak", result: "meow" },
] as const;

export const ITABLE_IIDS = ["draw", "clone", "speak"] as const;

function clone(table: VtableSlot[]): VtableSlot[] {
  return table.map((s) => ({ ...s }));
}

export function runStatic(objIndex: number): AlgoStep<VtableState>[] {
  const obj = VTABLE_OBJECTS[objIndex] ?? VTABLE_OBJECTS[0]!;
  let stamp: string = "static";
  let result: string | undefined = undefined;
  let shown: string | null = null;
  const rec = new StepRecorder<VtableState>(() => ({
    kind: "static" as VtableKind,
    obj: shown,
    cls: shown ? obj.cls : null,
    table: [],
    stamp,
    result,
  }));

  rec.record({ note: `Static ${obj.cls}.speak.` });
  shown = obj.id;
  rec.record({ codeLine: 0, note: `Object is ${obj.id}.` });
  rec.bump(VTABLE_COUNTERS.calls);
  result = obj.result;
  stamp = obj.result;
  rec.record({ codeLine: 1, note: `Call ${obj.fn} → ${obj.result}.` });
  return rec.steps;
}

export function runVtable(objIndex: number): AlgoStep<VtableState>[] {
  const obj = VTABLE_OBJECTS[objIndex] ?? VTABLE_OBJECTS[0]!;
  let table: VtableSlot[] = [];
  let stamp: string = "vtable";
  let result: string | undefined = undefined;
  let shown: string | null = null;
  const rec = new StepRecorder<VtableState>(() => ({
    kind: "vtable",
    obj: shown,
    cls: shown ? obj.cls : null,
    table: clone(table),
    stamp,
    result,
  }));

  rec.record({ note: `Dynamic ${obj.id}.speak.` });
  shown = obj.id;
  rec.record({ codeLine: 0, note: `Object is ${obj.id}.` });
  rec.bump(VTABLE_COUNTERS.lookups);
  table = [{ name: "speak", fn: obj.fn, active: false, matched: false }];
  rec.record({ codeLine: 1, note: `Load vptr → ${obj.cls}_vt.` });
  rec.bump(VTABLE_COUNTERS.lookups);
  table = [{ name: "speak", fn: obj.fn, active: true, matched: true }];
  rec.record({ codeLine: 2, note: `Slot 0 is ${obj.fn}.` });
  rec.bump(VTABLE_COUNTERS.calls);
  result = obj.result;
  stamp = obj.result;
  rec.record({ codeLine: 3, note: `Call ${obj.fn} → ${obj.result}.` });
  return rec.steps;
}

export function runItable(speakSlot: number): AlgoStep<VtableState>[] {
  const slot = Math.max(0, Math.min(speakSlot, ITABLE_IIDS.length - 1));
  const obj = VTABLE_OBJECTS[0]!;
  const names = ITABLE_IIDS.map((n, i) => (i === slot ? "speak" : n));
  const table: VtableSlot[] = names.map((name) => ({
    name,
    fn: name === "speak" ? obj.fn : "miss",
    active: false,
    matched: false,
  }));
  let stamp: string = "itable";
  let result: string | undefined = undefined;
  let shown: string | null = null;
  const rec = new StepRecorder<VtableState>(() => ({
    kind: "itable",
    obj: shown,
    cls: shown ? obj.cls : null,
    table: clone(table),
    stamp,
    result,
  }));

  rec.record({ note: `Interface speak on ${obj.id}. iid at slot ${slot}.` });
  shown = obj.id;
  rec.bump(VTABLE_COUNTERS.lookups);
  rec.record({ codeLine: 0, note: `Load vptr → ${obj.cls}_it.` });

  for (let i = 0; i <= slot; i++) {
    for (const s of table) s.active = false;
    table[i]!.active = true;
    rec.bump(VTABLE_COUNTERS.scans);
    rec.bump(VTABLE_COUNTERS.lookups);
    const hit = table[i]!.name === "speak";
    rec.record({
      codeLine: 1,
      note: hit ? `Slot ${i} is speak.` : `Slot ${i} is ${table[i]!.name}, not speak.`,
    });
    if (hit) {
      table[i]!.matched = true;
      break;
    }
  }

  rec.bump(VTABLE_COUNTERS.calls);
  result = obj.result;
  stamp = obj.result;
  rec.record({ codeLine: 2, note: `Call ${obj.fn} → ${obj.result}.` });
  return rec.steps;
}
