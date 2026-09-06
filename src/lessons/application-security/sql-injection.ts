import {
  INJECT_COUNTERS,
  runSqli,
} from "@/engine/algo/inject";
import type { AlgoDef } from "@/engine/algo/types";
import type { InjectState } from "@/engine/algo/views/inject";

/**
 * SQL Injection — archetype B (`engine: "steps"`).
 *
 * Three string ids: 1, 7, 9. Not a SQL parser. Concatenating `7 OR 1=1`
 * adds an OR operator node and matches every row. Binding the same
 * string as a parameter keeps it a leaf and matches nobody.
 *
 * THE CONTROL IS THE PAYLOAD. 0 is `7`, 1 is `7 OR 1=1`, default 1.
 * Two figures: concat vs param. Measured at payload 1: concat injected
 * 1, rows 3, result 1/7/9, ok false; param injected 0, rows 0, result
 * empty, ok true. Payload 0 is one row (7) either way, injected 0.
 *
 * MODELLING NOTE, and its limits. Parameterization means the whole
 * string is a leaf. Deliberately absent: a real grammar, a DBMS,
 * prepared statements in a driver. Those change the surface. They do
 * not change the argument: concat grows the tree, a parameter does not.
 */

const CONCAT_CODE = ["concat into AST", "match every row"];
const PARAM_CODE = ["bind as literal", "match that leaf"];

const counters = [
  { key: INJECT_COUNTERS.injected, label: "injected" },
  { key: INJECT_COUNTERS.rows, label: "rows" },
];

const sizeControl = {
  label: "payload",
  min: 0,
  max: 1,
  default: 1,
} as const;

/** Concatenate the payload into the query string. Payload 1 grows the tree. */
export const sqlInjectionAlgo: AlgoDef<InjectState, number> = {
  id: "sql-injection",
  title: "concat into AST",
  code: CONCAT_CODE,
  counters,
  size: sizeControl,
  generateInput: (_rng, size) => size,
  run: (payload) => runSqli("concat", payload),
};

/** Bind the payload as one literal leaf. The same string matches nobody. */
export const sqlInjectionParamAlgo: AlgoDef<InjectState, number> = {
  id: "sql-injection-param",
  title: "bind as literal",
  code: PARAM_CODE,
  counters,
  size: sizeControl,
  generateInput: (_rng, size) => size,
  run: (payload) => runSqli("param", payload),
};
