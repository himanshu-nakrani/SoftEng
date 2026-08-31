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
 * Thread Pools & Queueing — archetype B (`engine: "steps"`).
 *
 * The argument for a pool is not "threads are expensive" — it is that the
 * resource behind them is finite. Here that resource is two database
 * connections, modelled as a semaphore in shared state.
 *
 * Both figures do the SAME work through the SAME two connections, so the
 * comparison isolates one variable: how many threads are in flight. One thread
 * per request produces threads that exist only to wait; a pool sized to the
 * resource produces the same throughput with no waiting at all.
 *
 * Op counts are deliberately identical between the two, so any difference the
 * figure reports is contention and nothing else.
 */

const PER_REQUEST_CODE = [
  "per request:",
  "  spawn thread",
  "  acquire conn",
  "  query",
  "  release conn",
];

const POOL_CODE = [
  "pool of 2:",
  "  take next request",
  "  acquire conn",
  "  query",
  "  release conn",
];

const CONNECTIONS = 2;

/** One unit of work: take a connection, use it, give it back. */
function serve(label: string, line: number): ThreadOp[] {
  return [
    {
      label: `${label}: acquire conn`,
      codeLine: line,
      await: { label: "a free connection", ready: (memory) => memory.free > 0 },
      effect: (memory) => {
        memory.free -= 1;
      },
    },
    {
      label: `${label}: query`,
      codeLine: line + 1,
      effect: (memory) => {
        memory.served += 1;
      },
    },
    {
      label: `${label}: release conn`,
      codeLine: line + 2,
      effect: (memory) => {
        memory.free += 1;
      },
    },
  ];
}

/** Thread-per-request: one thread per unit of work, all alive at once. */
function perRequest(requests: number): Thread[] {
  return Array.from({ length: requests }, (_, i) => ({
    id: `req${i + 1}`,
    name: `request ${i + 1}`,
    ops: serve(`r${i + 1}`, 2),
  }));
}

/**
 * A pool of `CONNECTIONS` workers, each handling its share of the requests in
 * sequence. Same total work, but only as many threads as there are connections.
 */
function pool(requests: number): Thread[] {
  return Array.from({ length: CONNECTIONS }, (_, w) => {
    const mine: number[] = [];
    for (let i = w; i < requests; i += CONNECTIONS) mine.push(i + 1);
    return {
      id: `worker${w + 1}`,
      name: `worker ${w + 1}`,
      ops: mine.flatMap((n) => serve(`r${n}`, 2)),
    };
  });
}

function program(requests: number, pooled: boolean): Program {
  return {
    memory: { free: CONNECTIONS, served: 0 },
    threads: pooled ? pool(requests) : perRequest(requests),
  };
}

const counters = [
  { key: CONCURRENCY_COUNTERS.steps, label: "ops executed" },
  { key: CONCURRENCY_COUNTERS.waits, label: "times blocked" },
];

const size = { label: "requests", min: 4, max: 8, default: 6 };

/** One thread per request: most of them exist in order to wait. */
export const threadPerRequestAlgo: AlgoDef<ConcurrencyState, Program> = {
  id: "thread-pools",
  title: "one thread per request",
  code: PER_REQUEST_CODE,
  counters,
  size,
  generateInput: (_rng, requests) => program(requests, false),
  run: (input, rng) => interleave(input, rng),
};

/** A pool sized to the resource: same work, nobody waiting. */
export const threadPoolAlgo: AlgoDef<ConcurrencyState, Program> = {
  id: "thread-pools-pooled",
  title: "pool of 2, sized to the pool",
  code: POOL_CODE,
  counters,
  size,
  generateInput: (_rng, requests) => program(requests, true),
  run: (input, rng) => interleave(input, rng),
};
