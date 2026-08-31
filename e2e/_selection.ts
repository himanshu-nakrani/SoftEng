import {
  allLessons,
  legacyLessonPath,
  lessonPath,
  migratedLessons,
  modules,
} from "@/lib/curriculum";
import type { LessonMeta } from "@/curriculum/types";

/**
 * Route selection for the e2e suites.
 *
 * THE PROBLEM. Every suite here sweeps the registry, so their cost grows with the
 * curriculum. An axe scan is ~5s per lesson: tolerable at 35 lessons, roughly
 * fifteen minutes of pure scanning at the ~170 the roadmap implies. A pipeline
 * that slow stops being run, and a suite that is not run is not a suite.
 *
 * THE SHAPE OF THE ANSWER. Per-lesson coverage is not what catches regressions —
 * lesson pages are generated from the same handful of components, so the SECOND
 * lesson of a module rarely tells you anything the first did not. What varies is
 * the module: different figures, different overlays, different prose primitives.
 *
 * So a pull request scans one lesson per module (plus every hub route, which are
 * each unique), and the scheduled full run scans everything. `E2E_FULL=1` forces
 * the full sweep locally.
 *
 * This is a sampling strategy, stated plainly rather than hidden: a regression in
 * an unsampled lesson survives until the nightly run. That is the trade, and it is
 * why the nightly exists.
 */

export const FULL_RUN = process.env.E2E_FULL === "1";

const available = allLessons.filter((lesson) => lesson.status === "available");

/** The first available lesson of each module — one representative page shape. */
function representatives(): LessonMeta[] {
  const picked: LessonMeta[] = [];
  for (const mod of modules) {
    const first = mod.lessons.find((lesson) => lesson.status === "available");
    if (first) picked.push(first);
  }
  return picked;
}

/** Lessons to exercise this run: everything, or one per module. */
export function selectedLessons(): LessonMeta[] {
  return FULL_RUN ? available : representatives();
}

/** `{ slug, route }` pairs, which is what the specs title their cases with. */
export function selectedLessonRoutes(): { slug: string; route: string }[] {
  return selectedLessons().map((lesson) => ({
    slug: lesson.slug,
    route: lessonPath(lesson),
  }));
}

/**
 * Pre-migration URLs to check. Fixed in size forever — only track 01 ever moved —
 * so a sample of three is enough to prove the stub generator works; the full run
 * checks all of them.
 */
export function selectedLegacyRoutes(): { legacy: string; target: string }[] {
  /*
   * Derived, not listed. This used to exclude one module by name
   * (`!== "shared-state"`), which was correct when track 02 was the only later
   * track and silently wrong the moment track 03 added modules of its own — it
   * asserted redirects for URLs that never existed. Worse, the sampled run takes
   * only the first three, which are all track 01, so the mismatch could not
   * surface on a pull request and waited for the nightly.
   */
  const migrated = migratedLessons();
  const chosen = FULL_RUN ? migrated : migrated.slice(0, 3);
  return chosen.map((lesson) => ({
    legacy: legacyLessonPath(lesson),
    target: lessonPath(lesson),
  }));
}

/** One line for the run header, so a sampled run is never mistaken for a full one. */
export function selectionSummary(): string {
  const lessons = selectedLessons().length;
  return FULL_RUN
    ? `E2E_FULL=1 — all ${lessons} available lessons`
    : `sampled — ${lessons} of ${available.length} lessons (one per module); set E2E_FULL=1 for all`;
}

/**
 * Announce the selection once per RUN, not once per worker.
 *
 * Two processes import this module: the collection pass (where
 * `TEST_WORKER_INDEX` is unset) and each worker (where it is that worker's
 * index). Requiring it to be exactly "0" excludes both the collection pass and
 * every worker but the first.
 */
export function announceSelection(spec: string): void {
  if (process.env.TEST_WORKER_INDEX !== "0") return;
  console.log(`[${spec}] route selection: ${selectionSummary()}`);
}
