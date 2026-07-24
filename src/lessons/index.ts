import type { Accent } from "@/curriculum/types";
import type { LessonSim } from "@/engine/types";
import { cachingSim } from "./data/caching";
import { consistentHashingSim } from "./data/consistent-hashing";
import { replicationSim } from "./data/replication";
import { shardingSim } from "./data/sharding";
import { capTheoremSim } from "./distributed/cap-theorem";
import { messageQueuesSim } from "./distributed/message-queues";
import { rateLimitingSim } from "./distributed/rate-limiting";
import { clientServerSim } from "./scaling/client-server";
import { loadBalancingSim } from "./scaling/load-balancing";
import { scalingStrategiesSim } from "./scaling/scaling-strategies";

/**
 * All lesson sims for the playground picker. Sim ids match lesson slugs, so
 * titles/accents come from the curriculum registry at the call site.
 * (LessonSim is invariant in its state param — widen once here.)
 */
export type AnyLessonSim = LessonSim<Record<string, unknown>>;

const widen = (sim: unknown) => sim as AnyLessonSim;

export interface PlaygroundEntry {
  slug: string;
  title: string;
  accent: Accent;
  sim: AnyLessonSim;
}

export const playgroundSims: PlaygroundEntry[] = [
  { slug: "client-server", title: "Client & Server", accent: "amber", sim: widen(clientServerSim) },
  { slug: "scaling-strategies", title: "Vertical vs Horizontal", accent: "amber", sim: widen(scalingStrategiesSim) },
  { slug: "load-balancing", title: "Load Balancing", accent: "amber", sim: widen(loadBalancingSim) },
  { slug: "caching", title: "Caching", accent: "violet", sim: widen(cachingSim) },
  { slug: "replication", title: "Replication", accent: "violet", sim: widen(replicationSim) },
  { slug: "sharding", title: "Sharding", accent: "violet", sim: widen(shardingSim) },
  { slug: "consistent-hashing", title: "Consistent Hashing", accent: "violet", sim: widen(consistentHashingSim) },
  { slug: "rate-limiting", title: "Rate Limiting", accent: "cyan", sim: widen(rateLimitingSim) },
  { slug: "message-queues", title: "Message Queues", accent: "cyan", sim: widen(messageQueuesSim) },
  { slug: "cap-theorem", title: "CAP Theorem", accent: "cyan", sim: widen(capTheoremSim) },
];
