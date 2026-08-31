import {
  CONCURRENCY_COUNTERS,
  interleave,
  type Program,
  type Thread,
  type ThreadOp,
} from "@/engine/algo/concurrency";
import type { AlgoDef } from "@/engine/algo/types";
import type { ConcurrencyState } from "@/engine/algo/views/threads";

/**
 * Deadlock — archetype B (`engine: "steps"` in the registry).
 *
 * Two transfers between the same two accounts, each locking the accounts it
 * touches. Nothing here is a race: every critical section is properly guarded,
 * and that is exactly the point. The bug is not missing synchronisation, it is
 * the ORDER two correct threads take their locks in.
 *
 * Deliberately no `size` control. Deadlock needs exactly two threads and two
 * resources to be legible, and a slider that changed the thread count would
 * imply the phenomenon is about scale. Reseeding is the interaction that
 * matters: some interleavings hang, some sail through, and "it worked on my
 * machine" is the lesson.
 */

const LINE = {
  first: 0,
  second: 1,
  move: 2,
  releaseSecond: 3,
  releaseFirst: 4,
} as const;

const code = [
  "lock(first)",
  "lock(second)",
  "move 10",
  "unlock(second)",
  "unlock(first)",
];

/**
 * One transfer: take both account locks, move the money, release both.
 *
 * `first`/`second` are the ACQUISITION order — the only difference between the
 * broken version and the fixed one.
 */
function transfer(
  id: string,
  from: string,
  to: string,
  first: string,
  second: string,
): Thread {
  const ops: ThreadOp[] = [
    { label: `lock ${first}`, codeLine: LINE.first, lock: { action: "acquire", name: first } },
    { label: `lock ${second}`, codeLine: LINE.second, lock: { action: "acquire", name: second } },
    {
      label: `move 10: ${from} → ${to}`,
      codeLine: LINE.move,
      effect: (memory) => {
        memory[from] -= 10;
        memory[to] += 10;
      },
    },
    { label: `unlock ${second}`, codeLine: LINE.releaseSecond, lock: { action: "release", name: second } },
    { label: `unlock ${first}`, codeLine: LINE.releaseFirst, lock: { action: "release", name: first } },
  ];
  return { id, name: id, ops };
}

/** Both accounts start with 100; the pair of transfers should net to zero. */
function program(ordered: boolean): Program {
  return {
    memory: { A: 100, B: 100 },
    locks: ["A", "B"],
    threads: [
      // T1 always goes A then B.
      transfer("T1", "A", "B", "A", "B"),
      // T2 touches the same two accounts. Unordered, it grabs the one it is
      // sending FROM first — which is the whole bug.
      ordered
        ? transfer("T2", "B", "A", "A", "B")
        : transfer("T2", "B", "A", "B", "A"),
    ],
  };
}

const counters = [
  { key: CONCURRENCY_COUNTERS.steps, label: "ops executed" },
  { key: CONCURRENCY_COUNTERS.waits, label: "lock waits" },
];

/**
 * The classic AB/BA hold-and-wait. Each thread holds one lock and needs the
 * other; on the interleavings where both get their first lock before either gets
 * its second, neither can ever proceed.
 */
export const deadlockAlgo: AlgoDef<ConcurrencyState, Program> = {
  id: "deadlock",
  title: "transfer · unordered locks",
  code,
  counters,
  generateInput: () => program(false),
  run: (input, rng) => interleave(input, rng),
};

/**
 * The fix is not a bigger lock or a timeout: it is a global ORDER. If every
 * thread acquires A before B, a cycle is impossible — the thread holding B is
 * guaranteed to already hold A, so it can always finish.
 */
export const deadlockOrderedAlgo: AlgoDef<ConcurrencyState, Program> = {
  id: "deadlock-ordered",
  title: "transfer · ordered locks",
  code,
  counters,
  generateInput: () => program(true),
  run: (input, rng) => interleave(input, rng),
};
