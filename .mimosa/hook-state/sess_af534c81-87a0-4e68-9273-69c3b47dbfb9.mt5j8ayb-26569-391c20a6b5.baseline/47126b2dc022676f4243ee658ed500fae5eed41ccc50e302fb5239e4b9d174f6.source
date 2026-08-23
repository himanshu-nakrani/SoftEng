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
  /** URL segment — must match `src/app/learn/<module>/<slug>/page.tsx`. */
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
  /** Ordered — the denominator for lesson progress %. */
  sections: SectionMeta[];
}

export interface Module {
  slug: string;
  title: string;
  description: string;
  accent: Accent;
  lessons: LessonMeta[];
}

export interface Track {
  slug: string;
  title: string;
  description: string;
  modules: Module[];
}

export interface Curriculum {
  tracks: Track[];
}
