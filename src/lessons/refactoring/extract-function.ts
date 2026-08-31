import { REFACTOR_COUNTERS, runRefactor, type RefactorScript } from "@/engine/algo/refactor";
import type { AlgoDef } from "@/engine/algo/types";
import type { RefactorState } from "@/engine/algo/views/refactor";

/**
 * Extract Function — archetype B (the refactor workbench, `algo/refactor.ts`).
 *
 * The lesson that opens track 10, and the one the F spike
 * (`scripts/spike-f-refactor.mts`) was run to justify: it shows that a
 * refactoring MOVES a real metric, computed from the code's structure rather
 * than typed in by the author. `handle` carries a branchy validate block at its
 * top; extracting it into `validate` sheds those decision points, and the
 * figure's cyclomatic-complexity readout falls as a CONSEQUENCE — a number the
 * producer folds over the toy AST every frame, never a stored figure.
 *
 * MODELLING DECISION AND ITS LIMIT. The AST is a toy: enough control-flow node
 * kinds (branch / loop / && / || / case / call / plain) to define McCabe
 * complexity honestly, no expressions or types. So the extraction here is a
 * STRUCTURAL move of the node list, not a semantics-preserving compiler pass —
 * the lesson is what restructuring does to the metric, and a real grammar would
 * hide that behind parsing noise. The producer documents this at length.
 */

const CODE = [
  "handle(req):",
  "  if bad(a)||bad(b):",
  "    return err",
  "  if !ok(c)&&!ok(d):",
  "    return err",
  "  for f in fields:",
  "    log(f)",
  "  extract → validate()",
];

function extractScript(): RefactorScript {
  return {
    title: "A long handler",
    module: {
      fns: [
        {
          name: "handle",
          body: [
            {
              kind: "branch",
              text: "if bad(a) || bad(b)",
              body: [
                { kind: "or", text: "|| bad(b)" },
                { kind: "plain", text: "return err" },
              ],
            },
            {
              kind: "branch",
              text: "if !ok(c) && !ok(d)",
              body: [
                { kind: "and", text: "&& !ok(d)" },
                { kind: "plain", text: "return err" },
              ],
            },
            {
              kind: "loop",
              text: "for f in fields",
              body: [{ kind: "call", text: "log(f)", callee: "log" }],
            },
            { kind: "branch", text: "if !auth", body: [{ kind: "call", text: "reject()", callee: "reject" }] },
            { kind: "call", text: "route(req)", callee: "route" },
            { kind: "plain", text: "return ok" },
          ],
        },
        { name: "log", body: [{ kind: "plain", text: "return" }] },
        { name: "reject", body: [{ kind: "plain", text: "return" }] },
        {
          name: "route",
          body: [{ kind: "call", text: "log(x)", callee: "log" }, { kind: "plain", text: "return" }],
        },
      ],
    },
    // Lift the first three statements — the validate block — into validate().
    steps: [{ kind: "extract", from: "handle", start: 0, end: 3, into: "validate" }],
  };
}

export const extractFunctionAlgo: AlgoDef<RefactorState, RefactorScript> = {
  id: "extract-function",
  title: "extract function",
  code: CODE,
  counters: [
    { key: REFACTOR_COUNTERS.transforms, label: "transforms" },
    { key: REFACTOR_COUNTERS.extracted, label: "functions extracted" },
  ],
  generateInput: () => extractScript(),
  run: (input) => runRefactor(input),
};
