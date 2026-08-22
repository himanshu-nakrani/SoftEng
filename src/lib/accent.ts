import type { Accent, Difficulty } from "@/curriculum/types";

/**
 * Module accent → design token. The one mapping every surface reads, so the
 * landing manifest, lesson map, progress rings, and cards can't drift apart.
 * Dependency-free on purpose: safe for server-safe leaf components that must
 * not pull the curriculum registry into their module graph.
 */
export const accentCssVar: Record<Accent, string> = {
  cyan: "var(--color-glow-cyan)",
  violet: "var(--color-glow-violet)",
  amber: "var(--color-glow-amber)",
  green: "var(--color-glow-green)",
  red: "var(--color-glow-red)",
};

/**
 * Difficulty → text class. Lived duplicated in LessonMap and Lesson; this is
 * the single copy.
 */
export const difficultyClass: Record<Difficulty, string> = {
  foundational: "text-glow-green",
  intermediate: "text-glow-orange",
  advanced: "text-glow-violet",
};
