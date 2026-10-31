import type { AlgoDef, AlgoStep } from "@/engine/algo/types";
import type {
  PackageMetricRow,
  PackageTableState,
} from "@/engine/algo/views/table";

/**
 * Instability & Abstractness — archetype B (`engine: "steps"` in registry).
 *
 * Demonstrates Robert C. Martin's package metrics:
 * - Afferent Coupling (Ca): incoming dependencies from outside classes.
 * - Efferent Coupling (Ce): outgoing dependencies to outside classes.
 * - Instability I = Ce / (Ca + Ce): 0 (maximally stable) to 1 (maximally instable).
 * - Abstractness A = Na / Nc: ratio of abstract classes/interfaces to total types.
 * - Distance from Main Sequence D = |A + I - 1|: deviation from optimal balance.
 *
 * The scenario exhibits a core package in the Zone of Pain (A=0, I=0, D=1):
 * many packages depend on it (Ca=4, Ce=0), yet it contains zero abstractions,
 * making every change hazardous. Refactoring extracts interfaces, raising A to 0.5
 * and pulling D from 1.0 down to 0.5 towards the Main Sequence.
 */

export const INSTABILITY_CODE = [
  "// 1. Audit packages",
  "ca = afferent_deps(pkg)",
  "ce = efferent_deps(pkg)",
  "i = ce / (ca + ce)",
  "// 2. Measure abstract",
  "a = abstract_types/total",
  "d = abs(a + i - 1)",
  "// 3. Detect pain zone",
  "if i == 0 and a == 0:",
  "  alert(ZoneOfPain)",
  "// 4. Extract interfaces",
  "pkg.add_interfaces()",
  "a = 0.5 // A rises",
  "d = abs(0.5 + 0 - 1)",
  "// d drops to 0.5",
];

export interface InstabilityInput {
  focusPackage: string;
}

const BASE_PACKAGES: PackageMetricRow[] = [
  {
    name: "core",
    ca: 4,
    ce: 0,
    i: 0.0,
    a: 0.0,
    d: 1.0,
    zone: "Zone of Pain",
    highlight: true,
  },
  {
    name: "web-api",
    ca: 0,
    ce: 2,
    i: 1.0,
    a: 0.0,
    d: 0.0,
    zone: "Main Sequence",
    highlight: false,
  },
  {
    name: "billing-service",
    ca: 1,
    ce: 2,
    i: 0.67,
    a: 0.33,
    d: 0.0,
    zone: "Main Sequence",
    highlight: false,
  },
  {
    name: "plugin-spi",
    ca: 3,
    ce: 0,
    i: 0.0,
    a: 1.0,
    d: 0.0,
    zone: "Main Sequence",
    highlight: false,
  },
];

export function runInstability(
  input: InstabilityInput = { focusPackage: "core" },
): AlgoStep<PackageTableState>[] {
  const steps: AlgoStep<PackageTableState>[] = [];

  // Frame 0: Audit system packages
  steps.push({
    state: {
      kind: "package-metrics",
      packages: BASE_PACKAGES.map((p) => ({ ...p })),
      caption: "Auditing system packages: core has Ca=4 incoming dependents and Ce=0 outgoing.",
      highlightPackage: input.focusPackage,
    },
    codeLine: 0,
    note: "core has Ca=4, Ce=0",
    counters: { steps: 1, interfacesAdded: 0, distanceReduction: 0 },
  });

  // Frame 1: Calculate Instability I = Ce / (Ca + Ce)
  steps.push({
    state: {
      kind: "package-metrics",
      packages: BASE_PACKAGES.map((p) => ({ ...p })),
      caption: "Instability I = 0 / (4 + 0) = 0.00: core is maximally stable (rigid against change).",
      highlightPackage: input.focusPackage,
    },
    codeLine: 3,
    note: "I = 0.00: maximally stable",
    counters: { steps: 2, interfacesAdded: 0, distanceReduction: 0 },
  });

  // Frame 2: Measure Abstractness A = Na / Nc
  steps.push({
    state: {
      kind: "package-metrics",
      packages: BASE_PACKAGES.map((p) => ({ ...p })),
      caption: "Abstractness A = 0 interfaces / 4 classes = 0.00: core is completely concrete.",
      highlightPackage: input.focusPackage,
    },
    codeLine: 5,
    note: "A = 0.00: 100% concrete",
    counters: { steps: 3, interfacesAdded: 0, distanceReduction: 0 },
  });

  // Frame 3: Compute Distance D = |A + I - 1| -> Zone of Pain
  steps.push({
    state: {
      kind: "package-metrics",
      packages: BASE_PACKAGES.map((p) => ({ ...p })),
      caption: "Distance D = |0.00 + 0.00 - 1| = 1.00: trapped in the Zone of Pain!",
      highlightPackage: input.focusPackage,
    },
    codeLine: 8,
    note: "D = 1.00: Zone of Pain",
    counters: { steps: 4, interfacesAdded: 0, distanceReduction: 0 },
  });

  // Frame 4: Refactor - introduce abstract interfaces (A rises to 0.5)
  const refactoredPackages: PackageMetricRow[] = BASE_PACKAGES.map((p) => {
    if (p.name === input.focusPackage) {
      return {
        ...p,
        a: 0.5,
        d: 0.5,
        zone: "Main Sequence",
        highlight: true,
      };
    }
    return { ...p };
  });

  steps.push({
    state: {
      kind: "package-metrics",
      packages: refactoredPackages,
      caption: "Refactoring: 2 abstract interfaces extracted → Na=2, Nc=4, raising A to 0.50.",
      highlightPackage: input.focusPackage,
    },
    codeLine: 11,
    note: "Interfaces added: A rises to 0.50",
    counters: { steps: 5, interfacesAdded: 2, distanceReduction: 50 },
  });

  // Frame 5: Distance drops towards Main Sequence
  steps.push({
    state: {
      kind: "package-metrics",
      packages: refactoredPackages,
      caption: "Distance D = |0.50 + 0.00 - 1| = 0.50: distance cut in half towards the Main Sequence.",
      highlightPackage: input.focusPackage,
    },
    codeLine: 14,
    note: "D drops from 1.00 to 0.50",
    counters: { steps: 6, interfacesAdded: 2, distanceReduction: 50 },
  });

  return steps;
}

export const instabilityAbstractnessAlgo: AlgoDef<
  PackageTableState,
  InstabilityInput
> = {
  id: "instability-abstractness",
  title: "instability & abstractness",
  code: INSTABILITY_CODE,
  counters: [
    { key: "steps", label: "steps executed" },
    { key: "interfacesAdded", label: "interfaces added" },
    { key: "distanceReduction", label: "distance reduction %" },
  ],
  generateInput: () => ({ focusPackage: "core" }),
  run: (input) => runInstability(input),
};
