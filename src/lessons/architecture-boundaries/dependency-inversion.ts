import type { AlgoDef, AlgoStep } from "@/engine/algo/types";
import type {
  RowFrame,
  TableColumn,
  TableState,
} from "@/engine/algo/views/table";

/**
 * Dependency Inversion & Clean Architecture — archetype B (`engine: "steps"` in the registry).
 *
 * Demonstrates the inversion of source code dependencies across architectural
 * boundaries using Robert C. Martin's Dependency Inversion Principle (DIP) and
 * Alistair Cockburn's Ports & Adapters pattern.
 *
 * Progression across 4 steps:
 *   - Step 0 (Direct Coupling): OrderService directly imports PostgresDB and Sendgrid.
 *     Domain fan-out = 2, isolated_tests = 0.
 *   - Step 1 (Port Extraction): Domain declares abstract OrderRepository and NotificationService
 *     interfaces inside the domain boundary. Domain fan-out drops to 0.
 *   - Step 2 (Dependency Inversion): PostgresRepo implements OrderRepository; Sendgrid implements
 *     NotificationService. Dependencies point inward toward domain contracts.
 *   - Step 3 (Swappability & Test Isolation): Swap in InMemoryRepo and MockNotifier.
 *     Domain tests execute with 0 DB/network dependencies. Domain fan-out = 0, isolated_tests = 1.
 *
 * Code lines must be <= 27 characters (enforced by `check-curriculum`).
 */

const CODE = [
  "// Step 0: Direct coupling",
  "import { pg } from 'pg';",
  "import sg from 'sendgrid';",
  "class OrderService {",
  "  save() { pg.query(); }",
  "  send() { sg.send(); }",
  "}",
  "// Step 1: Extract ports",
  "interface OrderRepo {",
  "  save(o: Order): void;",
  "}",
  "interface Notifier {",
  "  send(m: Msg): void;",
  "}",
  "// Step 2: Invert arrows",
  "class PostgresRepo",
  "  implements OrderRepo {}",
  "class SendgridAdapter",
  "  implements Notifier {}",
  "// Step 3: Test isolation",
  "class InMemoryRepo",
  "  implements OrderRepo {}",
  "class MockNotifier",
  "  implements Notifier {}",
  "new OrderService(m, mock)",
  "test.runIsolated();",
];

const COLUMNS: TableColumn[] = [
  { key: "component", label: "Component", width: 140 },
  { key: "layer", label: "Layer", width: 130 },
  { key: "direction", label: "Direction", width: 140 },
  { key: "dependency", label: "Dependency / Port", width: 230 },
  { key: "coupling", label: "Coupling", width: 128 },
];

export interface ComponentRow {
  component: string;
  layer: string;
  direction: string;
  dependency: string;
  coupling: string;
}

export interface DependencyInversionScenario {
  initialRows: ComponentRow[];
}

function makeStep(
  activeComponent: string | null,
  components: ComponentRow[],
  codeLine: number,
  statement: string,
  anomaly: string,
  note: string,
  domainFanOut: number,
  isolatedTests: number,
): AlgoStep<TableState<number | string>> {
  const rowKeyMap: Record<number, string> = {
    0: "OrderService",
    1: "PostgresRepo",
    2: "SendgridNotifier",
    3: "HTTPController",
  };

  const rows: RowFrame<number | string>[] = components.map((c, idx) => ({
    key: rowKeyMap[idx] ?? c.component,
    committed: c.coupling,
    pending: {},
    values: {
      component: c.component,
      layer: c.layer,
      direction: c.direction,
      dependency: c.dependency,
      coupling: c.coupling,
    },
  }));

  return {
    state: {
      columns: COLUMNS,
      rows,
      txns: [],
      active: activeComponent,
      ranStatement: statement,
      isolation: "Architecture Boundaries · Dependency Inversion",
      anomaly,
    },
    codeLine,
    note,
    counters: {
      domain_fan_out: domainFanOut,
      fan_out: domainFanOut,
      isolated_tests: isolatedTests,
    },
  };
}

export function runDependencyInversionSteps(): AlgoStep<TableState<number | string>>[] {
  const step0Rows: ComponentRow[] = [
    {
      component: "OrderService",
      layer: "Domain",
      direction: "Outward → Infra",
      dependency: "PostgresDB, Sendgrid",
      coupling: "Direct (Fan-out: 2)",
    },
    {
      component: "PostgresRepo",
      layer: "Infra / Driven",
      direction: "Callee ← Domain",
      dependency: "pg_driver, SQL",
      coupling: "Concrete target",
    },
    {
      component: "SendgridNotifier",
      layer: "Infra / Driven",
      direction: "Callee ← Domain",
      dependency: "Sendgrid SDK, API",
      coupling: "Concrete target",
    },
    {
      component: "HTTPController",
      layer: "Infra / Driving",
      direction: "Inward → Domain",
      dependency: "OrderService",
      coupling: "Direct caller",
    },
  ];

  const step1Rows: ComponentRow[] = [
    {
      component: "OrderService",
      layer: "Domain",
      direction: "In-Boundary (Ports)",
      dependency: "OrderRepo, Notifier",
      coupling: "Abstract (Ports)",
    },
    {
      component: "PostgresRepo",
      layer: "Infra / Driven",
      direction: "Pending Inversion",
      dependency: "pg_driver, SQL",
      coupling: "Unbound concrete",
    },
    {
      component: "SendgridNotifier",
      layer: "Infra / Driven",
      direction: "Pending Inversion",
      dependency: "Sendgrid SDK, API",
      coupling: "Unbound concrete",
    },
    {
      component: "HTTPController",
      layer: "Infra / Driving",
      direction: "Inward → Domain",
      dependency: "OrderService",
      coupling: "Direct caller",
    },
  ];

  const step2Rows: ComponentRow[] = [
    {
      component: "OrderService",
      layer: "Domain",
      direction: "Core (Inward target)",
      dependency: "OrderRepo, Notifier",
      coupling: "Inverted (DIP)",
    },
    {
      component: "PostgresRepo",
      layer: "Infra / Driven",
      direction: "Inward → OrderRepo",
      dependency: "OrderRepo (implements)",
      coupling: "Inverted Adapter",
    },
    {
      component: "SendgridNotifier",
      layer: "Infra / Driven",
      direction: "Inward → Notifier",
      dependency: "Notifier (implements)",
      coupling: "Inverted Adapter",
    },
    {
      component: "HTTPController",
      layer: "Infra / Driving",
      direction: "Inward → Domain",
      dependency: "OrderService",
      coupling: "Direct caller",
    },
  ];

  const step3Rows: ComponentRow[] = [
    {
      component: "OrderService",
      layer: "Domain",
      direction: "Core (Isolated)",
      dependency: "OrderRepo, Notifier",
      coupling: "Isolated (0 I/O)",
    },
    {
      component: "PostgresRepo (InMemory)",
      layer: "Test / Driven",
      direction: "Inward → OrderRepo",
      dependency: "OrderRepo (in-memory)",
      coupling: "Test Double (Swapped)",
    },
    {
      component: "SendgridNotifier (Mock)",
      layer: "Test / Driven",
      direction: "Inward → Notifier",
      dependency: "Notifier (in-memory)",
      coupling: "Test Double (Swapped)",
    },
    {
      component: "HTTPController (Harness)",
      layer: "Test / Driving",
      direction: "Inward → Domain",
      dependency: "OrderService",
      coupling: "Unit Test Harness",
    },
  ];

  return [
    makeStep(
      "OrderService",
      step0Rows,
      3,
      "OrderService directly imports PostgresDB and Sendgrid",
      "⚠ Violation: Domain logic directly coupled to 2 infrastructure drivers",
      "Direct Coupling: OrderService directly imports PostgresDB and Sendgrid. Domain fan-out = 2, isolated_tests = 0.",
      2,
      0,
    ),
    makeStep(
      "OrderService",
      step1Rows,
      8,
      "Domain declares abstract OrderRepository and NotificationService ports",
      "✓ Port Extraction: Domain fan-out reduced to 0; ports declared inside domain boundary",
      "Port Extraction: Domain declares abstract OrderRepository and NotificationService interfaces inside domain boundary.",
      0,
      0,
    ),
    makeStep(
      "PostgresRepo",
      step2Rows,
      14,
      "PostgresRepo & SendgridAdapter implement domain ports; arrows point inward",
      "✓ Dependency Inversion: Adapters depend on domain abstractions; policy isolated",
      "Dependency Inversion: PostgresRepo implements OrderRepository; Sendgrid implements NotificationService. Dependencies point inward!",
      0,
      0,
    ),
    makeStep(
      "OrderService",
      step3Rows,
      24,
      "Swap in InMemoryRepo & MockNotifier: tests execute with 0 network/DB I/O",
      "✓ Swappability Verified: Domain tested in total isolation (isolated_tests = 1)",
      "Swappability & Test Isolation: Swap in InMemoryRepo and MockNotifier. Domain tests execute with 0 DB/network dependencies. Domain fan-out = 0, isolated_tests = 1.",
      0,
      1,
    ),
  ];
}

export const dependencyInversionAlgo: AlgoDef<
  TableState<number | string>,
  DependencyInversionScenario
> = {
  id: "dependency-inversion",
  title: "dependency inversion & clean architecture",
  code: CODE,
  counters: [
    { key: "domain_fan_out", label: "domain fan-out" },
    { key: "isolated_tests", label: "isolated tests" },
  ],
  generateInput: () => ({
    initialRows: [
      {
        component: "OrderService",
        layer: "Domain",
        direction: "Outward → Infra",
        dependency: "PostgresDB, Sendgrid",
        coupling: "Direct (Fan-out: 2)",
      },
      {
        component: "PostgresRepo",
        layer: "Infra / Driven",
        direction: "Callee ← Domain",
        dependency: "pg_driver, SQL",
        coupling: "Concrete target",
      },
      {
        component: "SendgridNotifier",
        layer: "Infra / Driven",
        direction: "Callee ← Domain",
        dependency: "Sendgrid SDK, API",
        coupling: "Concrete target",
      },
      {
        component: "HTTPController",
        layer: "Infra / Driving",
        direction: "Inward → Domain",
        dependency: "OrderService",
        coupling: "Direct caller",
      },
    ],
  }),
  run: () => runDependencyInversionSteps(),
};
