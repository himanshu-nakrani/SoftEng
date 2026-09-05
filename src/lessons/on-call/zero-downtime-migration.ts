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
 * Zero-Downtime Schema Migration — archetype G (branching-scenario producer).
 *
 * A high-traffic table handling 1,000 writes/sec needs a schema change: splitting
 * a monolithic `name` column into `first_name` and `last_name`. Under continuous
 * write load, an unthinking `ALTER TABLE RENAME COLUMN` takes an ACCESS EXCLUSIVE
 * lock that stalls the write queue and drops hundreds of transactions. Jumping
 * directly to new column reads causes null-pointer crashes across unbackfilled rows.
 *
 * Only the expand/contract pattern — adding nullable columns, dual writing,
 * backfilling in batches, switching reads, and contracting — completes all 200
 * runs with zero dropped writes and zero locks.
 */

function simulate(choiceId: "alter-table" | "premature-read" | "expand-contract", seed: number): RunResult {
  const rng = mulberry32(seed);

  if (choiceId === "alter-table") {
    // Under 1,000 writes/sec, ALTER TABLE requests an ACCESS EXCLUSIVE lock.
    // Waiting for running queries to clear and holding the exclusive catalog lock
    // stalls writers. Lock duration ranges ~200ms to ~350ms.
    // Client connection pool fills and write timeouts trigger, dropping 200+ writes.
    const lockDurationMs = 200 + Math.floor(rng() * 150);
    const incomingWrites = Math.floor(lockDurationMs * (0.95 + rng() * 0.1));
    const poolBuffer = 20;
    const rawDropped = Math.max(200, incomingWrites - poolBuffer);
    const droppedWrites = rawDropped >= 260 ? 300 : 200;
    return {
      ok: false,
      value: droppedWrites,
    };
  }

  if (choiceId === "premature-read") {
    // New app code deployed reading `first_name` and `last_name` before
    // the backfill script has migrated existing records.
    // Writes succeed, but reads to unbackfilled rows return NULL for non-nullable
    // expected fields, triggering NullPointerExceptions / missing row data.
    const rawNullReads = 200 + Math.floor(rng() * 150);
    const nullReads = rawNullReads >= 260 ? 300 : 200;
    return {
      ok: false,
      value: nullReads,
    };
  }

  // Expand / Contract:
  // 1. Add nullable column (lock duration ~0ms, metadata-only)
  // 2. App dual-writes to old and new columns (0 dropped writes)
  // 3. Batched backfill in background without table locking
  // 4. App reads from new columns (0 null reads because 100% backfilled)
  // 5. Contract: drop old column
  return {
    ok: true,
    value: 0,
  };
}

function scenario(): ScenarioSpec {
  return {
    prompt:
      "A table handles 1,000 writes/sec. You need to split the name column into first_name and last_name without downtime. Your call.",
    parameter: "migration and deployment sequence",
    sampleSize: 200,
    choices: [
      {
        id: "alter-table",
        label: "Single ALTER TABLE RENAME COLUMN in one migration",
        readKey: "dropped writes",
        run: (seed) => simulate("alter-table", seed),
      },
      {
        id: "premature-read",
        label: "Deploy new app code reading new column before backfilling old rows",
        readKey: "unmigrated null reads",
        run: (seed) => simulate("premature-read", seed),
      },
      {
        id: "expand-contract",
        label: "Expand/Contract: 1. Add nullable column -> 2. Dual write -> 3. Backfill -> 4. Read new -> 5. Drop old",
        readKey: "dropped writes",
        run: (seed) => simulate("expand-contract", seed),
      },
    ],
    verdict: (chosen, all) => {
      const others = all.filter((c) => c.id !== chosen.id);
      return `Your call completed cleanly in ${chosen.outcome.value}/${chosen.outcome.outOf} runs; alternatives held in ${others.map((o) => `${o.outcome.value}/${o.outcome.outOf}`).join(" and ")}.`;
    },
  };
}

export const zeroDowntimeMigrationAlgo: AlgoDef<ScenarioState, ScenarioInput> = {
  id: "zero-downtime-migration",
  title: "zero-downtime schema migration",
  code: [
    "alter table rename",
    "expand: add nullable col",
    "dual write traffic",
    "backfill legacy rows",
    "switch reads to new",
    "contract: drop old col",
  ],
  counters: [
    { key: SCENARIO_COUNTERS.measured, label: "options measured" },
    { key: SCENARIO_COUNTERS.runs, label: "sub-runs" },
  ],
  size: scenarioSize(scenario()),
  generateInput: (_rng, size) => scenarioInput(scenario(), size),
  run: (input) => runScenario(input.spec, input.choiceIndex),
};
