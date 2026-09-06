import {
  RUNTIME_COUNTERS,
  runBytecode,
  runWalk,
} from "@/engine/algo/runtime";
import type { AlgoDef } from "@/engine/algo/types";
import type { RuntimeState } from "@/engine/algo/views/runtime";

/**
 * Tree Walk vs Bytecode — archetype B (`engine: "steps"`).
 *
 * Same parsed tree, two evaluators. A walk visits every AST node. Bytecode
 * compiles the tree to a linear LOAD / MUL / ADD list and runs it on a
 * stack. Both yield 7 for 1+2*3. The walk visits 5 nodes; bytecode is 5
 * ops with stack max 3. (1+2)*3 is 9 with stack max 2 — ADD reduces the
 * left child before the third LOAD, so the stack never holds three values.
 *
 * THE CONTROL IS WHICH EXPRESSION. 0–2, default 1:
 *
 *   0  1+2        walk: result 3, visits 3.  bytecode: 3 ops, stack 2
 *   1  1+2*3      BOTH result 7. walk visits 5. bytecode 5 ops, stack 3
 *                 last notes: MUL. stack [1 6]. / ADD. stack [7]. /
 *                 1+2*3 = 7. stack max 3.
 *   2  (1+2)*3    both result 9. bytecode stack max 2
 *
 * Seed is ignored: an evaluator is not a scheduler.
 *
 * MODELLING NOTE, and its limits. Plus and star on single digits. No
 * locals, no real ISA. Deliberately absent: registers, jumps, a compiler.
 * Those change the instruction list. They do not change the argument: the
 * walk is recursive structure; bytecode is a linear list plus a stack; the
 * value is the same, the peak stack is not.
 */

const WALK_CODE = ["if n: return n", "return l op r"];

const BC_CODE = ["compile postfix", "dispatch op"];

const sizeControl = {
  label: "expr",
  min: 0,
  max: 2,
  default: 1,
} as const;

export const treeWalkVsBytecodeAlgo: AlgoDef<RuntimeState, number> = {
  id: "tree-walk-vs-bytecode",
  title: "walk",
  code: WALK_CODE,
  counters: [{ key: RUNTIME_COUNTERS.visits, label: "visits" }],
  size: sizeControl,
  generateInput: (_rng, size) => size,
  run: (exprIndex) => runWalk(exprIndex),
};

export const treeWalkVsBytecodeBcAlgo: AlgoDef<RuntimeState, number> = {
  id: "tree-walk-vs-bytecode-bc",
  title: "bytecode",
  code: BC_CODE,
  counters: [
    { key: RUNTIME_COUNTERS.ops, label: "ops" },
    { key: RUNTIME_COUNTERS.stack, label: "stack" },
  ],
  size: sizeControl,
  generateInput: (_rng, size) => size,
  run: (exprIndex) => runBytecode(exprIndex),
};
