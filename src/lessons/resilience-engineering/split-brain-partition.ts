import {
  runScenario,
  scenarioInput,
  scenarioSize,
  SCENARIO_COUNTERS,
  type RunResult,
  type ScenarioInput,
  type ScenarioSpec,
} from "@/engine/algo/scenario";
import type { AlgoDef } from "@/engine/algo/types";
import type { ScenarioState } from "@/engine/algo/views/scenario";
import { mulberry32 } from "@/engine/rng";

/**
 * Split-Brain and Network Partitions — Archetype G (branching-scenario producer, `algo/scenario.ts`).
 *
 * Models a 3-node distributed database cluster (Node 1, Node 2, Node 3) undergoing
 * an asymmetric network partition: Node 1 is completely severed from Nodes 2 and 3.
 *
 * Three partition policies are evaluated across 200 seeded incident runs:
 * - Choice A ("Both sides accept writes"): Node 1 (minority) and Nodes 2 & 3 (majority)
 *   both accept writes independently without global consensus. Write logs diverge,
 *   updates to identical keys conflict, and when the partition heals, reconciling
 *   divergent state overwrites uncoordinated writes, causing catastrophic data loss (0/200 safe).
 * - Choice B ("Freeze all writes across cluster"): Cluster detects missing heartbeats
 *   and refuses all write operations until full connectivity is restored. Consistency
 *   is preserved, but write availability drops to 0%, completely failing the SLA (0/200 meet SLA).
 * - Choice C ("Majority quorum with fencing"): Nodes 2 and 3 form a 2/3 majority quorum,
 *   acquire an incremented fencing epoch token, and commit writes safely. Isolated
 *   Node 1 detects the absence of a majority quorum, fences itself, and rejects writes.
 *   Upon healing, Node 1 reconciles smoothly from the authoritative majority log (200/200 safe).
 *
 * All pseudocode lines in `CODE` are <= 27 characters.
 */

export type PartitionPolicy = "both-accept" | "freeze-writes" | "majority-quorum";

const CODE = [
  "partition: Node 1 cut off",
  "heartbeat probe peers",
  "count active quorum",
  "if quorum < 2: fence node",
  "if quorum >= 2: commit",
  "sync logs on heal",
];

export function simulateSplitBrain(seed: number, policy: PartitionPolicy): RunResult {
  const rng = mulberry32(seed);

  if (policy === "both-accept") {
    // Both sides accept client writes concurrently without consensus.
    // Isolated Node 1 (minority) accepts writes locally;
    // Nodes 2 and 3 (majority) accept writes to overlapping keys.
    // Upon partition heal, the minority log diverges irrevocably and its writes
    // are overwritten during state reconciliation, destroying committed client data.
    const rawConflicts = 40 + Math.floor(rng() * 21); // 40..60
    const lostWrites = rawConflicts >= 50 ? 60 : 40;
    return {
      ok: false,
      value: lostWrites,
    };
  }

  if (policy === "freeze-writes") {
    // Cluster panics upon lost heartbeats and freezes all writes globally.
    // 0% write availability across all nodes; complete service outage.
    // Fails availability SLA across 100% of runs.
    return {
      ok: false,
      value: 0,
    };
  }

  // policy === "majority-quorum"
  // Nodes 2 and 3 establish a 2/3 majority quorum with an incremented fencing epoch.
  // Isolated Node 1 detects loss of quorum (1/3 < 2/3), fences itself, and rejects writes.
  // When the partition heals, Node 1 reconciles safely from the majority with 0 lost writes.
  return {
    ok: true,
    value: 0,
  };
}

function scenario(): ScenarioSpec {
  return {
    prompt:
      "A 3-node distributed database cluster partitions: Node 1 is isolated from Nodes 2 and 3. How do you handle client writes during the partition?",
    parameter: "partition write policy",
    sampleSize: 200,
    choices: [
      {
        id: "both-accept",
        label: "Both sides accept writes (divergent logs without coordination)",
        readKey: "lost writes",
        run: (seed) => simulateSplitBrain(seed, "both-accept"),
      },
      {
        id: "freeze-writes",
        label: "Freeze all writes across entire cluster until partition heals",
        readKey: "write availability (%)",
        run: (seed) => simulateSplitBrain(seed, "freeze-writes"),
      },
      {
        id: "majority-quorum",
        label: "Majority quorum (2/3) commits; isolated minority fences itself",
        readKey: "lost writes",
        run: (seed) => simulateSplitBrain(seed, "majority-quorum"),
      },
    ],
    verdict: (chosen, all) => {
      const others = all.filter((c) => c.id !== chosen.id);
      const summary = others
        .map((c) => `${c.outcome.value}/${c.outcome.outOf}`)
        .join(" and ");
      return `Your call held SLA and consistency in ${chosen.outcome.value}/${chosen.outcome.outOf} runs; alternatives held in ${summary}.`;
    },
  };
}

export const splitBrainPartitionAlgo: AlgoDef<ScenarioState, ScenarioInput> = {
  id: "split-brain-partition",
  title: "split-brain and network partitions",
  code: CODE,
  counters: [
    { key: SCENARIO_COUNTERS.measured, label: "options measured" },
    { key: SCENARIO_COUNTERS.runs, label: "sub-runs" },
  ],
  size: scenarioSize(scenario()),
  generateInput: (_rng, size) => scenarioInput(scenario(), size),
  run: (input) => runScenario(input.spec, input.choiceIndex),
};
