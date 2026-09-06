import type { AlgoDef, AlgoStep } from "@/engine/algo/types";
import type {
  RowFrame,
  TableColumn,
  TableState,
} from "@/engine/algo/views/table";

/**
 * The Strangler Fig Pattern — archetype B (`engine: "steps"` in the registry).
 *
 * Models incremental, zero-downtime migration of a legacy monolith to microservices
 * by intercepting ingress traffic with a routing facade proxy.
 *
 * What the steps prove:
 *   - Step 0 (Monolith Baseline): Monolith handles 100% of traffic across all 4 routes
 *     (/catalog, /orders, /payments, /users). Monolith = 100%, Microservice = 0%, Cutover = 0/4.
 *   - Step 1 (Deploy Facade Proxy): Transparent interceptor proxy placed in front of monolith.
 *     Facade routes 100% of traffic to monolith. 0 downtime.
 *   - Step 2 (Strangle Route 1: /catalog): New Catalog service deployed. Facade routes /catalog
 *     to microservice. Migrated = 1/4, Monolith traffic = 75%.
 *   - Step 3 (Strangle Route 2 & 3: /orders and /payments): Orders and Payments services deployed.
 *     Facade routes both to microservices. Migrated = 3/4, Monolith traffic = 25%.
 *   - Step 4 (Complete Monolith Decommissioning: /users): Users service migrated. Migrated = 4/4,
 *     Monolith traffic = 0%. Monolith safely decommissioned with 0 downtime.
 *
 * Code panel budget: every line in `def.code` MUST be <= 27 characters.
 */

const CODE = [
  "// Step 0: Monolith",
  "app.all(monolith)",
  "// Step 1: Deploy Facade",
  "facade = new Facade(mono)",
  "// Step 2: Strangle catalog",
  "facade.use(\"/catalog\", cat)",
  "// Step 3: Orders & pay",
  "facade.use(\"/orders\", ord)",
  "facade.use(\"/pay\", pay)",
  "// Step 4: Strangle users",
  "facade.use(\"/users\", usr)",
  "monolith.decommission()",
];

export const STRANGLER_FIG_COLUMNS: TableColumn[] = [
  { key: "route", label: "Route", width: 120 },
  { key: "target", label: "Target Service", width: 180 },
  { key: "monolithTraffic", label: "Monolith Traffic", width: 150 },
  { key: "microserviceTraffic", label: "Microservice Traffic", width: 170 },
  { key: "status", label: "Status", width: 148 },
];

export interface RouteMigration {
  route: string;
  target: string;
  monolithTraffic: string;
  microserviceTraffic: string;
  status: string;
}

export interface StranglerFigScenario {
  routes: string[];
}

function makeStep(
  activeRoute: string | null,
  routes: RouteMigration[],
  codeLine: number,
  statement: string,
  anomaly: string,
  note: string,
  monolithTraffic: number,
  microserviceTraffic: number,
  migratedRoutes: number,
  downtime: number,
): AlgoStep<TableState<number | string>> {
  const rows: RowFrame<number | string>[] = routes.map((r) => ({
    key: r.route,
    committed: r.monolithTraffic === "0%" ? 0 : 100,
    pending: {},
    values: {
      route: r.route,
      target: r.target,
      monolithTraffic: r.monolithTraffic,
      microserviceTraffic: r.microserviceTraffic,
      status: r.status,
    },
  }));

  return {
    state: {
      columns: STRANGLER_FIG_COLUMNS,
      rows,
      txns: [],
      active: activeRoute,
      ranStatement: statement,
      isolation: "Architecture Boundaries · Strangler Fig Pattern",
      anomaly,
    },
    codeLine,
    note,
    counters: {
      monolithTraffic,
      microserviceTraffic,
      migratedRoutes,
      downtime,
    },
  };
}

export function runStranglerFigSteps(): AlgoStep<TableState<number | string>>[] {
  const step0Routes: RouteMigration[] = [
    { route: "/catalog", target: "Monolith Core", monolithTraffic: "100%", microserviceTraffic: "0%", status: "Legacy Monolith" },
    { route: "/orders", target: "Monolith Core", monolithTraffic: "100%", microserviceTraffic: "0%", status: "Legacy Monolith" },
    { route: "/payments", target: "Monolith Core", monolithTraffic: "100%", microserviceTraffic: "0%", status: "Legacy Monolith" },
    { route: "/users", target: "Monolith Core", monolithTraffic: "100%", microserviceTraffic: "0%", status: "Legacy Monolith" },
  ];

  const step1Routes: RouteMigration[] = [
    { route: "/catalog", target: "Facade -> Monolith", monolithTraffic: "100%", microserviceTraffic: "0%", status: "Proxied (100% Monolith)" },
    { route: "/orders", target: "Facade -> Monolith", monolithTraffic: "100%", microserviceTraffic: "0%", status: "Proxied (100% Monolith)" },
    { route: "/payments", target: "Facade -> Monolith", monolithTraffic: "100%", microserviceTraffic: "0%", status: "Proxied (100% Monolith)" },
    { route: "/users", target: "Facade -> Monolith", monolithTraffic: "100%", microserviceTraffic: "0%", status: "Proxied (100% Monolith)" },
  ];

  const step2Routes: RouteMigration[] = [
    { route: "/catalog", target: "Catalog Service", monolithTraffic: "0%", microserviceTraffic: "100%", status: "Migrated to Microservice" },
    { route: "/orders", target: "Facade -> Monolith", monolithTraffic: "100%", microserviceTraffic: "0%", status: "Proxied (100% Monolith)" },
    { route: "/payments", target: "Facade -> Monolith", monolithTraffic: "100%", microserviceTraffic: "0%", status: "Proxied (100% Monolith)" },
    { route: "/users", target: "Facade -> Monolith", monolithTraffic: "100%", microserviceTraffic: "0%", status: "Proxied (100% Monolith)" },
  ];

  const step3Routes: RouteMigration[] = [
    { route: "/catalog", target: "Catalog Service", monolithTraffic: "0%", microserviceTraffic: "100%", status: "Migrated to Microservice" },
    { route: "/orders", target: "Orders Service", monolithTraffic: "0%", microserviceTraffic: "100%", status: "Migrated to Microservice" },
    { route: "/payments", target: "Payments Service", monolithTraffic: "0%", microserviceTraffic: "100%", status: "Migrated to Microservice" },
    { route: "/users", target: "Facade -> Monolith", monolithTraffic: "100%", microserviceTraffic: "0%", status: "Proxied (100% Monolith)" },
  ];

  const step4Routes: RouteMigration[] = [
    { route: "/catalog", target: "Catalog Service", monolithTraffic: "0%", microserviceTraffic: "100%", status: "Migrated to Microservice" },
    { route: "/orders", target: "Orders Service", monolithTraffic: "0%", microserviceTraffic: "100%", status: "Migrated to Microservice" },
    { route: "/payments", target: "Payments Service", monolithTraffic: "0%", microserviceTraffic: "100%", status: "Migrated to Microservice" },
    { route: "/users", target: "Users Service", monolithTraffic: "0%", microserviceTraffic: "100%", status: "Migrated to Microservice" },
  ];

  return [
    makeStep(
      null,
      step0Routes,
      1,
      "Step 0: Monolith handles 100% of all routes",
      "⚠ Monolith handles 100% traffic across all 4 routes (high blast radius)",
      "Monolith Baseline: Monolith handles 100% of traffic across all 4 routes. Monolith traffic = 100%, Microservice traffic = 0%, Cutover count = 0/4. 0 downtime.",
      100,
      0,
      0,
      0,
    ),
    makeStep(
      null,
      step1Routes,
      3,
      "Step 1: Interceptor facade proxy deployed in front of monolith",
      "✓ Routing proxy deployed: 100% traffic forwarded to monolith with 0 downtime",
      "Deploy Facade Proxy: Routing proxy deployed in front of monolith. All requests hit facade; facade routes 100% to monolith. 0 downtime.",
      100,
      0,
      0,
      0,
    ),
    makeStep(
      "/catalog",
      step2Routes,
      5,
      "Step 2: Facade routes /catalog to new Catalog Service",
      "✓ Strangled /catalog: 1/4 migrated, monolith traffic drops to 75%",
      "Strangle Route 1 (/catalog): New catalog service deployed. Facade routes /catalog traffic: 100% to microservice. Migrated = 1/4, monolith traffic = 75%. 0 downtime.",
      75,
      25,
      1,
      0,
    ),
    makeStep(
      "/orders",
      step3Routes,
      7,
      "Step 3: Facade routes /orders and /payments to domain services",
      "✓ Strangled /orders & /payments: 3/4 migrated, monolith traffic drops to 25%",
      "Strangle Route 2 & 3 (/orders and /payments): Orders & payments services deployed. Migrated = 3/4, monolith traffic = 25%. 0 downtime.",
      25,
      75,
      3,
      0,
    ),
    makeStep(
      "/users",
      step4Routes,
      11,
      "Step 4: /users migrated, legacy monolith decommissioned",
      "✓ Monolith decommissioned: 4/4 migrated (0% monolith traffic) with 0 downtime",
      "Complete Monolith Decommissioning (/users): User auth service migrated. Migrated = 4/4, monolith traffic = 0%! Monolith safely decommissioned with 0 downtime.",
      0,
      100,
      4,
      0,
    ),
  ];
}

export const stranglerFigAlgo: AlgoDef<TableState<number | string>, StranglerFigScenario> = {
  id: "strangler-fig",
  title: "the strangler fig pattern",
  code: CODE,
  counters: [
    { key: "monolithTraffic", label: "monolith traffic %" },
    { key: "microserviceTraffic", label: "microservice traffic %" },
    { key: "migratedRoutes", label: "migrated routes" },
    { key: "downtime", label: "downtime (min)" },
  ],
  generateInput: () => ({
    routes: ["/catalog", "/orders", "/payments", "/users"],
  }),
  run: () => runStranglerFigSteps(),
};
