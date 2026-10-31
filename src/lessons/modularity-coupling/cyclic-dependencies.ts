import type { AlgoDef, AlgoStep } from "@/engine/algo/types";
import type { TableState } from "@/engine/algo/views/table";

/**
 * Cyclic Dependencies & ADP — archetype B (`engine: "steps"` in the registry).
 *
 * Teaches the Acyclic Dependencies Principle (ADP):
 * Package dependency cycles make independent compilation and releases impossible.
 * In Step 1, Users -> Orders -> Billing -> Users form a circular dependency.
 * In Step 2, Tarjan DFS cycle detection runs and flags the deadlock.
 * In Step 3, Dependency Inversion Principle (DIP) extracts UsersInterface.
 * In Step 4, the cycle is broken (has_cycle = 0) and topological sort computes
 * the linear build/release order: [Billing, Users, Orders].
 *
 * Code lines must be <= 27 characters (the `algo integrity` check enforces it).
 */

export const CODE = [
  "g = initGraph()",
  "cycle = detectCycle(g)",
  "if (cycle) report(cycle)",
  "g = applyDIP(g)",
  "order = topoSort(g)",
];

export const CYCLIC_COUNTERS = {
  has_cycle: "has_cycle",
  packages: "packages",
} as const;

export interface DepGraphInput {
  packages: string[];
  dependencies: Record<string, string[]>;
}

export function detectCycle(graph: Record<string, string[]>): string[] | null {
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const path: string[] = [];

  function dfs(node: string): string[] | null {
    visited.add(node);
    inStack.add(node);
    path.push(node);

    for (const neighbor of graph[node] ?? []) {
      if (!visited.has(neighbor)) {
        const cycle = dfs(neighbor);
        if (cycle) return cycle;
      } else if (inStack.has(neighbor)) {
        const startIndex = path.indexOf(neighbor);
        return [...path.slice(startIndex), neighbor];
      }
    }

    path.pop();
    inStack.delete(node);
    return null;
  }

  for (const node of Object.keys(graph)) {
    if (!visited.has(node)) {
      const cycle = dfs(node);
      if (cycle) return cycle;
    }
  }

  return null;
}

export function topologicalSort(graph: Record<string, string[]>): {
  hasCycle: boolean;
  order: string[];
} {
  const inDegree: Record<string, number> = {};
  for (const node of Object.keys(graph)) {
    inDegree[node] = 0;
  }
  for (const neighbors of Object.values(graph)) {
    for (const neighbor of neighbors) {
      inDegree[neighbor] = (inDegree[neighbor] ?? 0) + 1;
    }
  }

  const queue: string[] = [];
  for (const [node, deg] of Object.entries(inDegree)) {
    if (deg === 0) {
      queue.push(node);
    }
  }

  const order: string[] = [];
  while (queue.length > 0) {
    const node = queue.shift()!;
    order.push(node);

    for (const neighbor of graph[node] ?? []) {
      inDegree[neighbor]--;
      if (inDegree[neighbor] === 0) {
        queue.push(neighbor);
      }
    }
  }

  const hasCycle = order.length !== Object.keys(graph).length;
  return {
    hasCycle,
    order: hasCycle ? [] : order,
  };
}

export function breakCycleWithDIP(
  graph: Record<string, string[]>,
): Record<string, string[]> {
  const updated: Record<string, string[]> = {};
  for (const [node, deps] of Object.entries(graph)) {
    if (node === "Billing") {
      updated[node] = ["Users"];
    } else if (node === "Users") {
      updated[node] = ["Orders"];
    } else if (node === "Orders") {
      updated[node] = [];
    } else {
      updated[node] = [...deps];
    }
  }
  return updated;
}

export const cyclicDependenciesAlgo: AlgoDef<TableState<string | number>, DepGraphInput> = {
  id: "cyclic-dependencies",
  title: "cyclic dependencies & adp",
  code: CODE,
  counters: [
    { key: CYCLIC_COUNTERS.has_cycle, label: "has cycle" },
    { key: CYCLIC_COUNTERS.packages, label: "packages" },
  ],
  generateInput: (): DepGraphInput => ({
    packages: ["Users", "Orders", "Billing"],
    dependencies: {
      Users: ["Orders"],
      Orders: ["Billing"],
      Billing: ["Users"],
    },
  }),
  run: (): AlgoStep<TableState<string | number>>[] => {
    return [
      {
        codeLine: 0,
        note: "Step 1: 3 packages form a circular cycle: Users -> Orders -> Billing -> Users.",
        counters: {
          [CYCLIC_COUNTERS.has_cycle]: 1,
          [CYCLIC_COUNTERS.packages]: 3,
        },
        state: {
          isolation: "CIRCULAR DEPENDENCY",
          rows: [
            { key: "Users", committed: "-> Orders", pending: {} },
            { key: "Orders", committed: "-> Billing", pending: {} },
            { key: "Billing", committed: "-> Users", pending: {} },
          ],
          txns: [
            {
              id: "topo",
              name: "Topological Sort",
              status: "active",
              next: "evaluating dependencies",
              seen: { Users: "Orders", Orders: "Billing", Billing: "Users" },
            },
          ],
          active: "topo",
          ranStatement: "cycle: Users->Orders->Billing",
          anomaly: "Cycle: Users -> Orders -> Billing -> Users (ADP violated)",
        },
      },
      {
        codeLine: 2,
        note: "Step 2: Tarjan DFS detects cycle; topological sort aborts with deadlock.",
        counters: {
          [CYCLIC_COUNTERS.has_cycle]: 1,
          [CYCLIC_COUNTERS.packages]: 3,
        },
        state: {
          isolation: "TARJAN CYCLE DFS",
          rows: [
            { key: "Users", committed: "-> Orders", lockedBy: "cycle member", pending: {} },
            { key: "Orders", committed: "-> Billing", lockedBy: "cycle member", pending: {} },
            { key: "Billing", committed: "-> Users", lockedBy: "cycle member", pending: {} },
          ],
          txns: [
            {
              id: "topo",
              name: "Topological Sort",
              status: "aborted",
              waitingOn: "circular wait: Users <-> Billing",
              seen: { cycle: "detected" },
            },
          ],
          active: "topo",
          ranStatement: "aborted: circular dependency",
          anomaly: "Cycle detected: Users -> Orders -> Billing -> Users (toposort failed)",
        },
      },
      {
        codeLine: 3,
        note: "Step 3: Dependency Inversion Principle (DIP): Billing depends on UsersInterface.",
        counters: {
          [CYCLIC_COUNTERS.has_cycle]: 0,
          [CYCLIC_COUNTERS.packages]: 4,
        },
        state: {
          isolation: "DIP INTERFACE EXTRACTION",
          rows: [
            { key: "Users", committed: "-> Orders", pending: {} },
            { key: "Orders", committed: "-> Billing", pending: {} },
            { key: "Billing", committed: "-> UsersInterface", pending: {} },
            { key: "UsersInterface", committed: "(in Users)", pending: {} },
          ],
          txns: [
            {
              id: "dip",
              name: "Interface Inversion",
              status: "active",
              next: "Billing -> UsersInterface",
              seen: { inverted: 1 },
            },
          ],
          active: "dip",
          ranStatement: "Billing -> UsersInterface",
          anomaly: undefined,
        },
      },
      {
        codeLine: 4,
        note: "Step 4: Cycle broken (has_cycle = 0)! Release order: [Billing, Users, Orders].",
        counters: {
          [CYCLIC_COUNTERS.has_cycle]: 0,
          [CYCLIC_COUNTERS.packages]: 3,
        },
        state: {
          isolation: "ACYCLIC RELEASE DAG",
          rows: [
            { key: "Billing", committed: "order: 1 (first)", pending: {} },
            { key: "Users", committed: "order: 2", pending: {} },
            { key: "Orders", committed: "order: 3 (last)", pending: {} },
          ],
          txns: [
            {
              id: "topo",
              name: "Release Order",
              status: "committed",
              next: "[Billing, Users, Orders]",
              seen: { release_order: 3 },
            },
          ],
          active: "topo",
          ranStatement: "[Billing, Users, Orders]",
          anomaly: undefined,
        },
      },
    ];
  },
};
