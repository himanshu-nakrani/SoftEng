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

/**
 * The built-in packet vocabulary — the types the engine ships a style for.
 * `Packet.type` is a plain string so lessons can mint their own kinds via
 * `LessonSim.packetStyles`; this union stays the named, shared set.
 */
export type PacketType =
  | "request"
  | "response"
  | "hit"
  | "miss"
  | "write"
  | "replication"
  | "drop"
  | "limited";

/**
 * How a packet type is drawn. Lessons register extra ones through
 * `LessonSim.packetStyles`; the engine's built-ins use the same shape.
 */
export interface PacketStyle {
  /**
   * MUST be a CSS custom-property reference — `"var(--color-glow-violet)"` —
   * never a literal hex/rgb. Stage visuals and UI chrome share one token set,
   * so a hard-coded color silently breaks theming.
   */
  color: string;
  /** Default radius in px for this type. Per-packet `size` still wins. */
  size?: number;
  /** Fade to transparent as progress → 1 — how the built-in "drop" dies. */
  fadeOut?: boolean;
}

export interface Packet {
  id: number;
  edgeId: string;
  /**
   * A `PacketType`, or any lesson-defined key of `LessonSim.packetStyles`.
   * Unknown types fall back to the "request" style rather than vanishing.
   */
  type: string;
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
  /**
   * Sim-seconds at spawn (`state.t`), stamped by `spawnPacket`. Subtract it
   * from `state.t` on arrival for a real per-packet latency sample.
   */
  bornAt: number;
  /**
   * Sim-seconds deadline. `expirePackets` reaps in-flight packets past it;
   * what that means (timeout, retry, drop) is the lesson's call.
   */
  diesAt?: number;
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
  /**
   * Bounded sample series, keyed like `metrics`. For measured *distributions*
   * a scalar can't express — per-packet latency, per-tick queue depth — fed by
   * `recordSample` and drawn by "sparkline" meters. Each array is a ring
   * trimmed from the front, so it is safe to append to every tick.
   */
  series: Record<string, number[]>;
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
  /**
   * Extra gate: the event fires on the first tick where `t >= at` AND this
   * returns true (absent = fire at `at`). Until then it stays pending — so a
   * beat can wait for the learner to reach a state ("once the queue backs up")
   * instead of a wall-clock moment. Fires at most once, ever. Must be pure:
   * it is called every tick after `at` until it passes.
   */
  when?: (state: SimState<L>, params: ParamValues) => boolean;
}

export interface QuizCheckpoint<L = Record<string, unknown>> {
  id: string;
  /** Sim hard-pauses when t crosses this. */
  at: number;
  question: string;
  choices: { id: string; label: string }[];
  correctChoiceId: string;
  /** Shown after answering, before "watch it happen". */
  explain: string;
  /**
   * Extra gate, same contract as `TimelineEvent.when`: the checkpoint fires on
   * the first tick where `t >= at` AND this returns true, at most once. A
   * checkpoint whose gate never passes simply never fires — headless tooling
   * must not assume every quiz in the array will be reported.
   */
  when?: (state: SimState<L>, params: ParamValues) => boolean;
}

export interface MeterSpec {
  /**
   * Reads SimState.metrics[metricKey] — and, for "sparkline", the matching
   * SimState.series[metricKey] ring.
   */
  metricKey: string;
  label: string;
  /**
   * "sparkline" = the counter readout plus an inline trace of the last ~80
   * samples of `series[metricKey]` (see `recordSample`). Use it when the shape
   * over time is the lesson — a latency tail, a queue sawtooth — not the
   * instantaneous number.
   */
  kind: "counter" | "bar" | "gauge" | "sparkline";
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
  quiz?: QuizCheckpoint<L>[];
  meters: MeterSpec[];
  /** Node runtime overrides at init (e.g. start a node degraded). */
  initialNodes?: Record<string, Partial<NodeRuntime>>;
  /**
   * Lesson-defined packet kinds, merged *over* the built-in `PacketType`
   * styles (so a lesson may also restyle a built-in). Keys are the strings
   * passed to `spawnPacket`; every `color` MUST be a CSS token reference —
   * `"var(--color-glow-cyan)"`, never `"#4dd"`.
   */
  packetStyles?: Record<string, PacketStyle>;
  /**
   * The key printed under the stage: which dot means what. Authors list ONLY
   * the types their sim actually spawns, in narrative order (the order the
   * learner meets them — request before response before retry), because the
   * legend reads as a sentence about the scenario, not as a palette dump.
   *
   * `type` is a key of the resolved style map (a `PacketType` or one of this
   * lesson's `packetStyles`); the swatch color is read from there, so legend
   * and stage can never disagree. Nothing is inferred: a sim without this
   * field renders no legend at all.
   */
  packetLegend?: { type: string; label: string }[];
}

/**
 * The L-independent subset of LessonSim — what render components consume.
 * (LessonSim<L> is invariant in L, so components that don't touch lesson
 * state accept this view instead of a concrete instantiation.)
 */
export type LessonSimView = Pick<
  LessonSim<unknown>,
  "id" | "topology" | "meters" | "params" | "packetStyles" | "packetLegend"
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
