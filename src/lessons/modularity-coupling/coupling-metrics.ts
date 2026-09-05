import type { AlgoDef, AlgoStep } from "@/engine/algo/types";
import type {
  PackageCoupling,
  RowFrame,
  TableColumn,
  TableState,
} from "@/engine/algo/views/table";

/**
 * Afferent & Efferent Coupling — archetype B (`engine: "steps"` in the registry).
 *
 * Quantifies incoming dependencies (Ca) and outgoing dependencies (Ce) across
 * package boundaries as a 4-package system (api, billing, orders, db) is refactored.
 *
 * What the numbers prove:
 *   - Initial state: billing directly imports api, orders, and db (Ce = 3).
 *     db is imported by api, orders, and billing (Ca = 3).
 *     Total system coupling is 12 (sum of all Ca + Ce across packages).
 *   - Step 1: Extract domain interface / repository boundary.
 *     billing defines PaymentRepo, severing its direct import of db.
 *     billing Ce drops from 3 to 2; db Ca drops from 3 to 2.
 *   - Step 2: Inject dependencies into billing.
 *     Caller provides authentication/context, removing billing's import of api.
 *     billing Ce drops from 3 to 1; api Ca drops from 1 to 0.
 *   - Step 3: Quantify how Ca and Ce move deterministically as code is restructured.
 *     Total coupling drops from 12 to 8. Conservation of edges holds at every step:
 *     sum(Ca) === sum(Ce).
 *
 * Code lines must be <= 27 characters (the algo integrity check enforces it).
 */

const CODE = [
  "// Step 0: tight coupling",
  "import api from 'api'",
  "import ord from 'orders'",
  "import db from 'db'",
  "// Step 1: boundary",
  "interface PaymentRepo",
  "// Step 2: inject deps",
  "Billing(repo, orders)",
  "// Step 3: audit metrics",
  "assert Ce(billing) == 1",
  "assert Ca(db) == 2",
];

const COLUMNS: TableColumn[] = [
  { key: "package", label: "Package", width: 150 },
  { key: "ca", label: "Ca (Afferent / Incoming)", width: 210 },
  { key: "ce", label: "Ce (Efferent / Outgoing)", width: 210 },
  { key: "total", label: "Total Coupling", width: 190 },
];

export interface CouplingScenario {
  initialPackages: PackageCoupling[];
}

function makeStep(
  activePkg: string | null,
  packages: PackageCoupling[],
  codeLine: number,
  statement: string,
  anomaly: string,
  note: string,
  stepsCount: number,
  decoupledCount: number,
): AlgoStep<TableState> {
  const rows: RowFrame[] = packages.map((p) => ({
    key: p.name,
    committed: p.total,
    pending: {},
    values: {
      package: p.name,
      ca: p.ca,
      ce: p.ce,
      total: p.total,
    },
  }));

  return {
    state: {
      columns: COLUMNS,
      rows,
      txns: [],
      active: activePkg,
      ranStatement: statement,
      isolation: "Modularity · Coupling Metrics",
      anomaly,
      packages,
    },
    codeLine,
    note,
    counters: {
      steps: stepsCount,
      decoupled: decoupledCount,
    },
  };
}

export function runCouplingSteps(): AlgoStep<TableState>[] {
  const step0Pkgs: PackageCoupling[] = [
    { name: "api", ca: 1, ce: 2, total: 3 },
    { name: "billing", ca: 0, ce: 3, total: 3 },
    { name: "orders", ca: 2, ce: 1, total: 3 },
    { name: "db", ca: 3, ce: 0, total: 3 },
  ];

  const step1Pkgs: PackageCoupling[] = [
    { name: "api", ca: 1, ce: 2, total: 3 },
    { name: "billing", ca: 0, ce: 2, total: 2 },
    { name: "orders", ca: 2, ce: 1, total: 3 },
    { name: "db", ca: 2, ce: 0, total: 2 },
  ];

  const step2Pkgs: PackageCoupling[] = [
    { name: "api", ca: 0, ce: 2, total: 2 },
    { name: "billing", ca: 0, ce: 1, total: 1 },
    { name: "orders", ca: 2, ce: 1, total: 3 },
    { name: "db", ca: 2, ce: 0, total: 2 },
  ];

  const step3Pkgs: PackageCoupling[] = [
    { name: "api", ca: 0, ce: 2, total: 2 },
    { name: "billing", ca: 0, ce: 1, total: 1 },
    { name: "orders", ca: 2, ce: 1, total: 3 },
    { name: "db", ca: 2, ce: 0, total: 2 },
  ];

  return [
    makeStep(
      "billing",
      step0Pkgs,
      3,
      "Initial state: billing directly imports api, orders, and db",
      "⚠ High coupling: billing Ce=3, db Ca=3 (blast radius: 3 packages)",
      "Initial state: billing directly imports api, orders, db (Ce=3); db has Ca=3.",
      0,
      0,
    ),
    makeStep(
      "billing",
      step1Pkgs,
      5,
      "Step 1: Extract domain interface / repository boundary",
      "✓ billing decoupled from db: billing Ce drops 3 → 2, db Ca drops 3 → 2",
      "Extracted PaymentRepo interface in billing: billing no longer imports concrete db.",
      1,
      1,
    ),
    makeStep(
      "billing",
      step2Pkgs,
      7,
      "Step 2: Inject dependencies, reducing Ce of billing from 3 to 1",
      "✓ Dependencies injected: billing Ce reduced from 3 to 1, api Ca drops 1 → 0",
      "Injected dependencies into billing: caller provides auth context, removing api import.",
      2,
      2,
    ),
    makeStep(
      "billing",
      step3Pkgs,
      9,
      "Step 3: Quantify how Ca and Ce move deterministically",
      "✓ Deterministic proof: total system coupling fell from 12 to 8",
      "Metrics audit: billing Ce reduced 3 → 1, db Ca reduced 3 → 2, total coupling 12 → 8.",
      3,
      2,
    ),
  ];
}

export const couplingMetricsAlgo: AlgoDef<TableState, CouplingScenario> = {
  id: "coupling-metrics",
  title: "afferent & efferent coupling",
  code: CODE,
  counters: [
    { key: "steps", label: "refactor steps" },
    { key: "decoupled", label: "dependencies decoupled" },
  ],
  generateInput: () => ({
    initialPackages: [
      { name: "api", ca: 1, ce: 2, total: 3 },
      { name: "billing", ca: 0, ce: 3, total: 3 },
      { name: "orders", ca: 2, ce: 1, total: 3 },
      { name: "db", ca: 3, ce: 0, total: 3 },
    ],
  }),
  run: () => runCouplingSteps(),
};
