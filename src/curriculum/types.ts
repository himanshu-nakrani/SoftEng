export type Difficulty = "foundational" | "intermediate" | "advanced";

export type SectionKind = "concept" | "interactive" | "quiz";

export type Accent = "cyan" | "violet" | "amber" | "green" | "red";

export interface SectionMeta {
  /** Anchor id within the lesson page, e.g. "write-policies". */
  id: string;
  /** Shown in the sticky mini-TOC / checkpoint list. */
  title: string;
  /**
   * Drives how the section completes:
   * - concept: IntersectionObserver dwell
   * - interactive / quiz: explicit onComplete from the embedded component
   */
  kind: SectionKind;
}

export interface LessonMeta {
  /**
   * URL segment — must match `src/app/learn/<track>/<module>/<slug>/page.tsx`.
   * Globally unique across every track: it keys progress and routing.
   */
  slug: string;
  moduleSlug: string;
  title: string;
  /** One-liner for cards and the lesson map. */
  tagline: string;
  difficulty: Difficulty;
  estimatedMinutes: number;
  /**
   * Lesson slugs recommended before this one. SOFT gate: suggested order and
   * visual hint only, never hard-locked (localStorage wipes must not strand
   * users).
   */
  prerequisites: string[];
  /**
   * `coming-soon` lessons appear dimmed on the map with no route yet;
   * the curriculum check script only enforces routes for `available`.
   */
  status: "available" | "coming-soon";
  /**
   * Which interaction engine the lesson's figure is built on. Determines what
   * `src/lessons/<module>/<slug>.ts` must export and which test matrix the
   * lesson joins:
   *
   * - `flow` (default) — archetype A, a `LessonSim`: continuous packet flow,
   *   golden-pinned by `src/lessons/__tests__/goldens.test.ts`.
   * - `steps` — archetype B, an `AlgoDef`: a precomputed step list with
   *   step-back and scrubbing. Not in `SIM_BY_KEY`, so it does not join the
   *   packet-sim invariant matrix; its engine is covered by
   *   `src/engine/algo/__tests__/`.
   *
   * Omitted means `flow`, so the 26 existing lessons need no edit.
   */
  engine?: "flow" | "steps";
  /** Ordered — the denominator for lesson progress %. */
  sections: SectionMeta[];
}

export interface Module {
  slug: string;
  title: string;
  description: string;
  /**
   * OPTIONAL override of the track's accent. `Accent` is a closed five-value
   * union, so per-module hues cannot scale past one track's worth of modules —
   * a second track that also coloured every module would exhaust the palette
   * and make hue meaningless as an identifier. New tracks should normally omit
   * this and inherit; read it through `accentOf(module)`, never directly.
   */
  accent?: Accent;
  lessons: LessonMeta[];
}

export interface Track {
  /** URL segment — the first path segment under `/learn/`. */
  slug: string;
  title: string;
  description: string;
  /** The track's identity hue, and the fallback for every module in it. */
  accent: Accent;
  modules: Module[];
}

export interface Curriculum {
  tracks: Track[];
}
