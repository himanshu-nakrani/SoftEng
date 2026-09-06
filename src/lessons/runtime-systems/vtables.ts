import type { AlgoDef } from "@/engine/algo/types";
import {
  VTABLE_COUNTERS,
  runItable,
  runStatic,
  runVtable,
} from "@/engine/algo/vtable";
import type { VtableState } from "@/engine/algo/views/vtable";

/**
 * Virtual Method Tables — archetype B (`engine: "steps"`).
 *
 * Three ways to find speak. Static: the call site is the function, 0
 * lookups. Vtable: load vptr, then slot 0 — 2 lookups. Dog → woof,
 * Cat → meow. Itable: load vptr, then scan until the iid matches.
 * Slot 0 scans 1 (lookups 2). Slot 2 scans 3 (lookups 4).
 *
 * THE VTABLE SLIDER IS WHICH OBJECT, 0 dog / 1 cat, default 0.
 * THE ITABLE SLIDER IS WHICH SLOT HOLDING speak, 0–2, default 2.
 * Static has the same object slider so dog/cat still change the name
 * of the function, with lookups still 0.
 *
 * Seed is ignored. A dispatch table is not a scheduler.
 *
 * MODELLING NOTE, and its limits. Two classes, one method, a three-slot
 * itable of draw/clone/speak. Deliberately absent: multiple inheritance,
 * fat pointers, inline caches. Those change the constants. They do not
 * change the argument: a named call is 0 extra loads, a vtable is 2,
 * an interface is 1 plus a scan.
 */

const STATIC_CODE = ["obj is Dog", "call Dog_speak"];
const VTABLE_CODE = ["obj", "load vptr", "index slot 0", "call"];
const ITABLE_CODE = ["load vptr", "scan iid", "call"];

const counters = [
  { key: VTABLE_COUNTERS.lookups, label: "lookups" },
  { key: VTABLE_COUNTERS.scans, label: "scans" },
  { key: VTABLE_COUNTERS.calls, label: "calls" },
];

export const vtablesStaticAlgo: AlgoDef<VtableState, number> = {
  id: "vtables-static",
  title: "named call",
  code: STATIC_CODE,
  counters,
  size: { label: "object", min: 0, max: 1, default: 0 },
  generateInput: (_rng, size) => size,
  run: (size) => runStatic(size),
};

export const vtablesAlgo: AlgoDef<VtableState, number> = {
  id: "vtables",
  title: "two loads",
  code: VTABLE_CODE,
  counters,
  size: { label: "object", min: 0, max: 1, default: 0 },
  generateInput: (_rng, size) => size,
  run: (size) => runVtable(size),
};

export const vtablesItableAlgo: AlgoDef<VtableState, number> = {
  id: "vtables-itable",
  title: "scan until speak",
  code: ITABLE_CODE,
  counters,
  size: { label: "speak slot", min: 0, max: 2, default: 2 },
  generateInput: (_rng, size) => size,
  run: (size) => runItable(size),
};
