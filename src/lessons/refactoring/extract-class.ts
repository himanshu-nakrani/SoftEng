import { REFACTOR_COUNTERS, runRefactor, type RefactorScript } from "@/engine/algo/refactor";
import type { AlgoDef } from "@/engine/algo/types";
import type { RefactorState } from "@/engine/algo/views/refactor";

/**
 * Extract Class — archetype B (the refactor workbench, `algo/refactor.ts`).
 *
 * A class or handler that does two disparate jobs is a god class: it lacks
 * cohesion and couples to unrelated parts of the system. Here, `OrderProcessor`
 * computes totals (pricing, tax, discounts) AND formats receipts and notifications.
 *
 * Before extraction, `OrderProcessor` carries high cyclomatic complexity (cc 7)
 * and high fan-out (fan 5), calling both calculation helpers (`calcTax`,
 * `applyDiscount`) and presentation/notification helpers (`formatItem`,
 * `sendEmail`, `renderPdf`).
 *
 * Extracting the receipt formatting and delivery responsibilities into a dedicated
 * `ReceiptFormatter` helper class/function partitions the concerns:
 * - `OrderProcessor` sheds its formatting decision points (cc falls from 7 to 3)
 *   and drops its coupling to presentation (fan-out falls from 5 to 3).
 * - `ReceiptFormatter` encapsulates the formatting branches (cc 5) and presentation
 *   dependencies (fan-out 3).
 * - Module max cyclomatic complexity drops from 7 to 5, and max fan-out drops from 5 to 3.
 * - Total decision points across the module are conserved at 6.
 */

const CODE = [
  "OrderProcessor():",
  "  calcTax(item)",
  "  applyDiscount(o)",
  "  formatItem(item)",
  "  renderPdf(order)",
  "  sendEmail(order)",
  "  extract →",
  "    ReceiptFormatter()",
];

function extractClassScript(): RefactorScript {
  return {
    title: "A god class: OrderProcessor",
    module: {
      fns: [
        {
          name: "OrderProcessor",
          body: [
            {
              kind: "loop",
              text: "for item in items",
              body: [{ kind: "call", text: "calcTax(item)", callee: "calcTax" }],
            },
            {
              kind: "branch",
              text: "if hasDiscount",
              body: [{ kind: "call", text: "applyDiscount(o)", callee: "applyDiscount" }],
            },
            { kind: "plain", text: "total = sum + tax" },
            {
              kind: "loop",
              text: "for item in items",
              body: [{ kind: "call", text: "formatItem(item)", callee: "formatItem" }],
            },
            {
              kind: "branch",
              text: "if giftWrap",
              body: [{ kind: "plain", text: "text += giftNote" }],
            },
            {
              kind: "branch",
              text: "if sendEmail",
              body: [{ kind: "call", text: "sendEmail(order)", callee: "sendEmail" }],
            },
            {
              kind: "branch",
              text: "if pdfReceipt",
              body: [{ kind: "call", text: "renderPdf(order)", callee: "renderPdf" }],
            },
            { kind: "plain", text: "return total" },
          ],
        },
        { name: "calcTax", body: [{ kind: "plain", text: "return item * tax" }] },
        { name: "applyDiscount", body: [{ kind: "plain", text: "return sub - disc" }] },
        { name: "formatItem", body: [{ kind: "plain", text: "return row(item)" }] },
        { name: "sendEmail", body: [{ kind: "plain", text: "deliver(mail)" }] },
        { name: "renderPdf", body: [{ kind: "plain", text: "return doc" }] },
      ],
    },
    steps: [
      {
        kind: "extract",
        from: "OrderProcessor",
        start: 3,
        end: 7,
        into: "ReceiptFormatter",
        label: "Extract Class",
        note: "Extract ReceiptFormatter from OrderProcessor: separates calculation from receipt formatting",
      },
    ],
  };
}

function extractedClassScript(): RefactorScript {
  return {
    title: "Cohesive classes",
    module: {
      fns: [
        {
          name: "OrderProcessor",
          body: [
            {
              kind: "loop",
              text: "for item in items",
              body: [{ kind: "call", text: "calcTax(item)", callee: "calcTax" }],
            },
            {
              kind: "branch",
              text: "if hasDiscount",
              body: [{ kind: "call", text: "applyDiscount(o)", callee: "applyDiscount" }],
            },
            { kind: "plain", text: "total = sum + tax" },
            { kind: "call", text: "ReceiptFormatter()", callee: "ReceiptFormatter" },
            { kind: "plain", text: "return total" },
          ],
        },
        {
          name: "ReceiptFormatter",
          body: [
            {
              kind: "loop",
              text: "for item in items",
              body: [{ kind: "call", text: "formatItem(item)", callee: "formatItem" }],
            },
            {
              kind: "branch",
              text: "if giftWrap",
              body: [{ kind: "plain", text: "text += giftNote" }],
            },
            {
              kind: "branch",
              text: "if sendEmail",
              body: [{ kind: "call", text: "sendEmail(order)", callee: "sendEmail" }],
            },
            {
              kind: "branch",
              text: "if pdfReceipt",
              body: [{ kind: "call", text: "renderPdf(order)", callee: "renderPdf" }],
            },
          ],
        },
        { name: "calcTax", body: [{ kind: "plain", text: "return item * tax" }] },
        { name: "applyDiscount", body: [{ kind: "plain", text: "return sub - disc" }] },
        { name: "formatItem", body: [{ kind: "plain", text: "return row(item)" }] },
        { name: "sendEmail", body: [{ kind: "plain", text: "deliver(mail)" }] },
        { name: "renderPdf", body: [{ kind: "plain", text: "return doc" }] },
      ],
    },
    steps: [],
  };
}

export const extractClassAlgo: AlgoDef<RefactorState, RefactorScript> = {
  id: "extract-class",
  title: "extract class",
  code: CODE,
  counters: [
    { key: REFACTOR_COUNTERS.transforms, label: "transforms" },
    { key: REFACTOR_COUNTERS.extracted, label: "classes extracted" },
  ],
  generateInput: () => extractClassScript(),
  run: (input) => runRefactor(input),
};

export const extractClassExtractedAlgo: AlgoDef<RefactorState, RefactorScript> = {
  id: "extract-class-extracted",
  title: "extracted class",
  code: CODE,
  counters: [
    { key: REFACTOR_COUNTERS.transforms, label: "transforms" },
    { key: REFACTOR_COUNTERS.extracted, label: "classes extracted" },
  ],
  generateInput: () => extractedClassScript(),
  run: (input) => runRefactor(input),
};
