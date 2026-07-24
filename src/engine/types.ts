/* ---------------------------------------------------------------------------
   Engine model types — the contract between lesson definitions and the
   simulation/rendering kit. Lessons only ever compose these; they never
   touch the render internals.
--------------------------------------------------------------------------- */

/* ---------- Topology (static, hand-authored per lesson) ---------- */

export type NodeKind =
  | "client"
  | "server"
  | "loadbalancer"
  | "database"
  | "cache"
  | "queue"
  | "shard";

export type NodeHealth = "healthy" | "degraded" | "dead";

export interface NodeSpec {
  id: string;
  kind: NodeKind;
  /** Monospace label, e.g. "api-2". */
  label: string;
  /** Center coordinates in the fixed 800x450 viewBox. */
  x: number;
  y: number;
  /** Learner can click to kill/revive ("break it" interaction). */
  breakable?: boolean;
}

export interface EdgeSpec {
  id: string;
  from: string; // NodeSpec.id
  to: string;
  /** Bézier bow, -1..1; 0 = straight line. */
  curve?: number;
}

export interface Topology {
  nodes: NodeSpec[];
  edges: EdgeSpec[];
}

/* ---------- Simulation entities (dynamic, owned by the sim) ---------- */

export type PacketType =
  | "request"
  | "response"
  | "hit"
  | "miss"
  | "write"
  | "replication"
  | "drop"
  | "limited";

export interface Packet {
  id: number;
  edgeId: string;
  type: PacketType;
  /** 0..1 along the edge path. */
  progress: number;
  /** Progress units per sim-second. */
  speed: number;
  /** Traveling to → from (responses). */
  reverse?: boolean;
  /** Radius in px (default 4). */
  size?: number;
  /** Lesson-specific routing data (target shard, key hash, …). */
  payload?: Record<string, unknown>;
}

export interface NodeRuntime {
  health: NodeHealth;
  /** 0..1 — drives the in-node load bar. */
  load: number;
  /** Shown as a count chip on queue-ish nodes. */
  queueDepth?: number;
  /**
   * Unprovisioned capacity: rendered as a faint dashed outline, receives no
   * traffic (e.g. servers you haven't added yet in a scaling lesson).
   */
  ghost?: boolean;
  /** Lesson-specific (cache contents, token count, …). */
  meta?: Record<string, unknown>;
}

/* ---------- The world ---------- */

export interface SimState<L = Record<string, unknown>> {
  /** Sim time, seconds. Distinct from wall time: pausable, steppable, scalable. */
  t: number;
  /** In-flight packets. Hard cap enforced by the engine (see PACKET_POOL). */
  packets: Packet[];
  nodes: Record<string, NodeRuntime>;
  /** Meter values: "latency", "throughput", "hitRatio", … */
  metrics: Record<string, number>;
  /** Lesson-private state. */
  lesson: L;
  /** Seeded RNG (mulberry32) — same seed ⇒ identical run. */
  rng: () => number;
  /** Monotonic packet id source. */
  nextPacketId: number;
}

/* ---------- Lesson contract ---------- */

export type ParamValue = number | boolean | string;
export type ParamValues = Record<string, ParamValue>;

export interface ParamOption {
  value: string;
  label: string;
}

export interface ParamSpec {
  key: string;
  label: string;
  kind: "slider" | "toggle" | "select" | "button";
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  options?: ParamOption[]; // for "select"
  /**
   * For "button": engine sets params[key]=true on press; the lesson's step
   * function consumes it and must reset it to false.
   */
  defaultValue: ParamValue;
}

export interface TimelineEvent<L = Record<string, unknown>> {
  /** Sim seconds. */
  at: number;
  /** Narration shown when the event fires. */
  caption?: string;
  /** Mutates state in place (engine passes the live state object). */
  apply?: (state: SimState<L>) => void;
}

export interface QuizCheckpoint {
  id: string;
  /** Sim hard-pauses when t crosses this. */
  at: number;
  question: string;
  choices: { id: string; label: string }[];
  correctChoiceId: string;
  /** Shown after answering, before "watch it happen". */
  explain: string;
}

export interface MeterSpec {
  /** Reads SimState.metrics[metricKey]. */
  metricKey: string;
  label: string;
  kind: "counter" | "bar" | "gauge";
  max?: number; // for bar/gauge scaling
  unit?: string; // "ms", "req/s", "%"
  /** Optional display precision (default 0 decimal places). */
  decimals?: number;
  /** Meter turns red past this value. */
  dangerAbove?: number;
  /** For inverted metrics (hit ratio): red *below* this. */
  dangerBelow?: number;
}

export interface LessonSim<L = Record<string, unknown>> {
  id: string;
  topology: Topology;
  params: ParamSpec[];
  /** Returns lesson-private state; engine builds the rest of SimState. */
  init: (rng: () => number) => L;
  /**
   * Advance the world by dt sim-seconds. Mutates `state` in place —
   * reducer-shaped but mutation-friendly (the sim is never serialized).
   */
  step: (state: SimState<L>, dt: number, params: ParamValues) => void;
  /** Scripted scenario: "api-2 dies at t=10". */
  timeline?: TimelineEvent<L>[];
  /** Prediction checkpoints: pause → ask → resume proves the answer. */
  quiz?: QuizCheckpoint[];
  meters: MeterSpec[];
  /** Node runtime overrides at init (e.g. start a node degraded). */
  initialNodes?: Record<string, Partial<NodeRuntime>>;
}

/**
 * The L-independent subset of LessonSim — what render components consume.
 * (LessonSim<L> is invariant in L, so components that don't touch lesson
 * state accept this view instead of a concrete instantiation.)
 */
export type LessonSimView = Pick<
  LessonSim<unknown>,
  "id" | "topology" | "meters" | "params"
>;

/* ---------- Engine constants ---------- */

/** Fixed logical timestep (seconds). 30 ticks/sec. */
export const TICK = 1 / 30;

/** Pooled packet elements; also the hard cap on in-flight packets.
 *  High load is shown via aggregates (queue bars, glow), never more dots. */
export const PACKET_POOL = 128;

/** Stage coordinate space. */
export const STAGE_W = 800;
export const STAGE_H = 450;
