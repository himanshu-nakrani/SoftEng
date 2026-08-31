import { REFACTOR_COUNTERS, runRefactor, type RefactorScript } from "@/engine/algo/refactor";
import type { AlgoDef } from "@/engine/algo/types";
import type { RefactorState } from "@/engine/algo/views/refactor";

/**
 * Duplicated Logic — archetype B (the refactor workbench).
 *
 * The refactoring that moves a DIFFERENT metric from Extract Function. Two
 * handlers carry the same validation branch inline, so the module reports a
 * duplicated block. Extract the block once, then point the second handler at the
 * SAME function rather than making a second copy — and the duplication count
 * falls to zero while the total decision points ACTUALLY DROP, because a copy of
 * the branch was removed rather than merely relocated.
 *
 * WHY THIS CONTRASTS WITH EXTRACT FUNCTION. A pure extraction conserves total
 * decision points (it moves them). De-duplication does not: it deletes a copy.
 * That is the honest difference the two lessons draw, and it is why the
 * producer's `dedupe` transform (reuse an existing function) exists separately
 * from `extract` (make a new one) — extracting the second copy into its own
 * function would leave duplication untouched, which the figure would show.
 *
 * MODELLING LIMIT. Same toy AST as the whole track: control-flow node kinds
 * only, structural rewrites rather than semantics-preserving passes. Two blocks
 * are "the same" here when their AST subtrees have an identical structural
 * signature — a real de-dup needs to prove behavioural equivalence, which this
 * deliberately does not attempt.
 */

const CODE = [
  "createUser(u):",
  "  if !valid(u)||old(u):",
  "    reject",
  "  save(u)",
  "updateUser(u):",
  "  if !valid(u)||old(u):",
  "    reject",
  "  patch(u)",
];

function guard() {
  return {
    kind: "branch" as const,
    text: "if !valid(u) || old(u)",
    body: [
      { kind: "or" as const, text: "|| old(u)" },
      { kind: "plain" as const, text: "reject" },
    ],
  };
}

function dupScript(): RefactorScript {
  return {
    title: "Two handlers, one guard",
    module: {
      fns: [
        {
          name: "createUser",
          body: [guard(), { kind: "call", text: "save(u)", callee: "save" }, { kind: "plain", text: "return" }],
        },
        {
          name: "updateUser",
          body: [guard(), { kind: "call", text: "patch(u)", callee: "patch" }, { kind: "plain", text: "return" }],
        },
        { name: "save", body: [{ kind: "plain", text: "return" }] },
        { name: "patch", body: [{ kind: "plain", text: "return" }] },
      ],
    },
    steps: [
      // Extract the guard from the first handler into a new shared function.
      { kind: "extract", from: "createUser", start: 0, end: 1, into: "validate" },
      // Then REUSE it from the second handler, rather than extracting a copy.
      { kind: "dedupe", from: "updateUser", start: 0, end: 1, into: "validate" },
    ],
  };
}

export const duplicatedLogicAlgo: AlgoDef<RefactorState, RefactorScript> = {
  id: "duplicated-logic",
  title: "duplicated logic",
  code: CODE,
  counters: [
    { key: REFACTOR_COUNTERS.transforms, label: "transforms" },
    { key: REFACTOR_COUNTERS.extracted, label: "functions extracted" },
  ],
  generateInput: () => dupScript(),
  run: (input) => runRefactor(input),
};
