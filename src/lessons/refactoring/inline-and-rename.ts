import { REFACTOR_COUNTERS, runRefactor, type RefactorScript } from "@/engine/algo/refactor";
import type { AlgoDef } from "@/engine/algo/types";
import type { RefactorState } from "@/engine/algo/views/refactor";

/**
 * Inline & Rename — archetype B (the refactor workbench).
 *
 * The lesson that stops the track reading as "refactoring always lowers the
 * numbers". Two transforms that DON'T reduce complexity: inlining an
 * over-thin helper folds its one-line body back into its single caller (the
 * helper disappears, the caller's fan-out falls by the edge it no longer needs),
 * and renaming a vague function updates every call site while touching no metric
 * at all. Structure is a DIAL, not a ratchet — extraction and inlining are
 * inverse moves, and the right direction depends on whether a name is pulling
 * its weight, which no metric can decide for you.
 *
 * MODELLING LIMIT. Same toy AST as the track. Inline here is a structural splice
 * of the callee's node list into the caller; a real inline must also rename
 * captured locals and preserve evaluation order, which this does not model
 * because the lesson is about what inlining does to the module's SHAPE and its
 * fan-out, not about the mechanics of a safe inline.
 */

const CODE = [
  "render():",
  "  x = getX()",
  "  draw(x)",
  "getX():",
  "  return cfg.x",
  "proc():",
  "  doThing()",
  "  → rename commit",
];

function script(): RefactorScript {
  return {
    title: "An over-thin helper",
    module: {
      fns: [
        {
          name: "render",
          body: [{ kind: "call", text: "getX()", callee: "getX" }, { kind: "plain", text: "draw(x)" }],
        },
        { name: "getX", body: [{ kind: "plain", text: "return cfg.x" }] },
        {
          name: "proc",
          body: [{ kind: "call", text: "doThing()", callee: "doThing" }, { kind: "plain", text: "return" }],
        },
        { name: "doThing", body: [{ kind: "branch", text: "if ready", body: [{ kind: "plain", text: "go" }] }] },
      ],
    },
    steps: [
      // Inline the one-line getX back into its single caller: it earns nothing.
      { kind: "inline", caller: "render", callee: "getX" },
      // Rename the vague doThing to something that says what it does.
      { kind: "rename", from: "doThing", to: "commit" },
    ],
  };
}

export const inlineAndRenameAlgo: AlgoDef<RefactorState, RefactorScript> = {
  id: "inline-and-rename",
  title: "inline and rename",
  code: CODE,
  counters: [{ key: REFACTOR_COUNTERS.transforms, label: "transforms" }],
  generateInput: () => script(),
  run: (input) => runRefactor(input),
};
