import {
  REFACTOR_COUNTERS,
  runRefactor,
  type AstNode,
  type RefactorScript,
} from "@/engine/algo/refactor";
import type { AlgoDef } from "@/engine/algo/types";
import type { RefactorState } from "@/engine/algo/views/refactor";

/**
 * Replace Conditional with Polymorphism — archetype B (the refactor workbench).
 *
 * Cascading conditionals (switch statements or chained if-else on a type code)
 * concentrate branching logic into a single hotspot. Every new variant forces an
 * edit to the same centralized method, ballooning its cyclomatic complexity (cc)
 * and violating the Open-Closed Principle.
 *
 * Replacing the conditional with polymorphism replaces the type check with dynamic
 * dispatch. The centralized dispatcher sheds all its branches (its cc drops from 6
 * to 1), and each variant becomes an independent strategy class or subclass whose
 * method has cc = 1.
 *
 * What the numbers prove:
 *   - The monolithic dispatcher opens at cyclomatic complexity 6 (5 decision points).
 *   - Each refactoring step extracts one type arm into a standalone strategy class (cc = 1).
 *   - As branches are lifted, the dispatcher's complexity drops sequentially: 6 → 5 → 4 → 3 → 2 → 1.
 *   - In the polymorphic final state, EVERY function in the module has cc = 1.
 *   - Under polymorphic dispatch, adding a new type (OCP) touches ZERO existing code.
 *
 * Code lines must be <= 27 characters (the algo integrity check enforces it).
 */

const CODE = [
  "calcShipping(pkg):",
  "  switch pkg.type:",
  "    standard → fee()",
  "    express  → fee()",
  "    overnigh → fee()",
  "    freight  → fee()",
  "    intl     → fee()",
  "  strategy.fee(pkg)",
];

const POLY_CODE = [
  "// Open-Closed Principle",
  "class SameDay:",
  "  calcFee(pkg):",
  "    return 40",
  "// zero edits to caller",
  "registry.add(SameDay)",
];

function standardHandler(): AstNode[] {
  return [{ kind: "plain", text: "return 10" }];
}

function expressHandler(): AstNode[] {
  return [{ kind: "plain", text: "return 25" }];
}

function overnightHandler(): AstNode[] {
  return [{ kind: "plain", text: "return 50" }];
}

function freightHandler(): AstNode[] {
  return [{ kind: "plain", text: "return 120" }];
}

function intlHandler(): AstNode[] {
  return [{ kind: "plain", text: "return 85" }];
}

function sameDayHandler(): AstNode[] {
  return [{ kind: "plain", text: "return 40" }];
}

function replaceConditionalScript(): RefactorScript {
  return {
    title: "Type-dispatching switch chain",
    module: {
      fns: [
        {
          name: "calcShipping",
          body: [
            {
              kind: "branch",
              text: "if type == standard",
              body: [{ kind: "plain", text: "return 10" }],
            },
            {
              kind: "branch",
              text: "if type == express",
              body: [{ kind: "plain", text: "return 25" }],
            },
            {
              kind: "branch",
              text: "if type == overnight",
              body: [{ kind: "plain", text: "return 50" }],
            },
            {
              kind: "branch",
              text: "if type == freight",
              body: [{ kind: "plain", text: "return 120" }],
            },
            {
              kind: "branch",
              text: "if type == intl",
              body: [{ kind: "plain", text: "return 85" }],
            },
            { kind: "plain", text: "return 0" },
          ],
        },
      ],
    },
    steps: [
      {
        kind: "polymorph",
        from: "calcShipping",
        handler: "StandardFee",
        body: standardHandler(),
        updatedDispatcherBody: [
          {
            kind: "branch",
            text: "if type == express",
            body: [{ kind: "plain", text: "return 25" }],
          },
          {
            kind: "branch",
            text: "if type == overnight",
            body: [{ kind: "plain", text: "return 50" }],
          },
          {
            kind: "branch",
            text: "if type == freight",
            body: [{ kind: "plain", text: "return 120" }],
          },
          {
            kind: "branch",
            text: "if type == intl",
            body: [{ kind: "plain", text: "return 85" }],
          },
          { kind: "plain", text: "return 0" },
        ],
        label: "Extract Standard Strategy",
        note: "Extracted StandardFee strategy (cc 1): calcShipping drops to cc 5",
      },
      {
        kind: "polymorph",
        from: "calcShipping",
        handler: "ExpressFee",
        body: expressHandler(),
        updatedDispatcherBody: [
          {
            kind: "branch",
            text: "if type == overnight",
            body: [{ kind: "plain", text: "return 50" }],
          },
          {
            kind: "branch",
            text: "if type == freight",
            body: [{ kind: "plain", text: "return 120" }],
          },
          {
            kind: "branch",
            text: "if type == intl",
            body: [{ kind: "plain", text: "return 85" }],
          },
          { kind: "plain", text: "return 0" },
        ],
        label: "Extract Express Strategy",
        note: "Extracted ExpressFee strategy (cc 1): calcShipping drops to cc 4",
      },
      {
        kind: "polymorph",
        from: "calcShipping",
        handler: "OvernightFee",
        body: overnightHandler(),
        updatedDispatcherBody: [
          {
            kind: "branch",
            text: "if type == freight",
            body: [{ kind: "plain", text: "return 120" }],
          },
          {
            kind: "branch",
            text: "if type == intl",
            body: [{ kind: "plain", text: "return 85" }],
          },
          { kind: "plain", text: "return 0" },
        ],
        label: "Extract Overnight Strategy",
        note: "Extracted OvernightFee strategy (cc 1): calcShipping drops to cc 3",
      },
      {
        kind: "polymorph",
        from: "calcShipping",
        handler: "FreightFee",
        body: freightHandler(),
        updatedDispatcherBody: [
          {
            kind: "branch",
            text: "if type == intl",
            body: [{ kind: "plain", text: "return 85" }],
          },
          { kind: "plain", text: "return 0" },
        ],
        label: "Extract Freight Strategy",
        note: "Extracted FreightFee strategy (cc 1): calcShipping drops to cc 2",
      },
      {
        kind: "polymorph",
        from: "calcShipping",
        handler: "IntlFee",
        body: intlHandler(),
        updatedDispatcherBody: [
          { kind: "call", text: "strategy.fee()", callee: "strategy" },
          { kind: "plain", text: "return fee" },
        ],
        label: "Polymorphic Dispatch",
        note: "All branches eliminated: calcShipping reaches cc 1 via polymorphic dispatch",
      },
    ],
  };
}

function polymorphicExtensionScript(): RefactorScript {
  return {
    title: "Polymorphic strategies under extension",
    module: {
      fns: [
        {
          name: "calcShipping",
          body: [
            { kind: "call", text: "strategy.fee()", callee: "strategy" },
            { kind: "plain", text: "return fee" },
          ],
        },
        { name: "StandardFee", body: standardHandler() },
        { name: "ExpressFee", body: expressHandler() },
        { name: "OvernightFee", body: overnightHandler() },
        { name: "FreightFee", body: freightHandler() },
        { name: "IntlFee", body: intlHandler() },
      ],
    },
    steps: [
      {
        kind: "add-strategy",
        name: "SameDayFee",
        body: sameDayHandler(),
        label: "Add Strategy (OCP)",
        note: "Added SameDayFee strategy (cc 1): calcShipping and existing classes untouched",
      },
    ],
  };
}

export const replaceConditionalAlgo: AlgoDef<RefactorState, RefactorScript> = {
  id: "replace-conditional",
  title: "replace conditional with polymorphism",
  code: CODE,
  counters: [
    { key: REFACTOR_COUNTERS.transforms, label: "transforms" },
    { key: REFACTOR_COUNTERS.extracted, label: "strategies extracted" },
  ],
  generateInput: () => replaceConditionalScript(),
  run: (input) => runRefactor(input),
};

export const replaceConditionalPolymorphicAlgo: AlgoDef<
  RefactorState,
  RefactorScript
> = {
  id: "replace-conditional-polymorphic",
  title: "polymorphic extension (open-closed)",
  code: POLY_CODE,
  counters: [
    { key: REFACTOR_COUNTERS.transforms, label: "transforms" },
    { key: REFACTOR_COUNTERS.extracted, label: "strategies extracted" },
  ],
  generateInput: () => polymorphicExtensionScript(),
  run: (input) => runRefactor(input),
};
