import { curriculum } from "@/curriculum/registry";
import type { Accent, LessonMeta, Module, Track } from "@/curriculum/types";
import { shareMetadata } from "@/lib/site";
import type { Metadata } from "next";

export const tracks: Track[] = curriculum.tracks;

/**
 * The first track. Kept ONLY for surfaces that are legitimately about the
 * entry point into the curriculum (the landing page's headline offer).
 * Anything that renders "the current track" must take the track as an
 * argument instead — see `trackOfLesson` / `trackBySlug`.
 */
export const firstTrack: Track = curriculum.tracks[0];

/**
 * All modules across every track, in curriculum order.
 *
 * DANGER: this is a cross-track flattening. It is correct for global indexes
 * (sitemap, the review deck, the test matrix) and WRONG for anything a learner
 * reads as "my progress" or "my sidebar" — those must be scoped with
 * `modulesOfTrack`, or a second track silently dilutes the denominator.
 */
export const modules: Module[] = tracks.flatMap((t) => t.modules);

/** All lessons in curriculum order (track → module → lesson). Same caveat. */
export const allLessons: LessonMeta[] = modules.flatMap((m) => m.lessons);

const bySlug = new Map(allLessons.map((l) => [l.slug, l]));
const moduleBySlug = new Map(modules.map((m) => [m.slug, m]));
const trackBySlugMap = new Map(tracks.map((t) => [t.slug, t]));

/** module slug → owning track. Built once; `trackOf` is O(1). */
const trackByModuleSlug = new Map<string, Track>(
  tracks.flatMap((t) => t.modules.map((m) => [m.slug, t] as const)),
);

export function getLesson(slug: string): LessonMeta | undefined {
  return bySlug.get(slug);
}

export function getModule(slug: string): Module | undefined {
  return moduleBySlug.get(slug);
}

export function getTrack(slug: string): Track | undefined {
  return trackBySlugMap.get(slug);
}

export function moduleOf(lesson: LessonMeta): Module {
  // Registry guarantees every lesson's moduleSlug resolves.
  return moduleBySlug.get(lesson.moduleSlug)!;
}

export function trackOf(module: Module): Track {
  // Registry guarantees every module slug is globally unique and owned.
  return trackByModuleSlug.get(module.slug)!;
}

export function trackOfLesson(lesson: LessonMeta): Track {
  return trackByModuleSlug.get(lesson.moduleSlug)!;
}

/** Modules belonging to one track — the track-scoped form of `modules`. */
export function modulesOfTrack(track: Track): Module[] {
  return track.modules;
}

/** Lessons of one track in curriculum order — the scoped form of `allLessons`. */
export function lessonsOfTrack(track: Track): LessonMeta[] {
  return track.modules.flatMap((m) => m.lessons);
}

/**
 * A module's effective hue: its own override, else its track's identity.
 * Every surface must resolve accents through here rather than reading
 * `module.accent`, which is optional by design.
 */
export function accentOf(module: Module): Accent {
  return module.accent ?? trackOf(module).accent;
}

/** 1-based position, for the "track 01" plate stamp. */
export function trackNumber(track: Track): number {
  return tracks.indexOf(track) + 1;
}

/**
 * Prerequisite labels for display, annotated when the prerequisite lives in
 * ANOTHER track.
 *
 * Cross-track prerequisites are allowed — track 02's databases work genuinely
 * builds on track 01's replication — and `check-curriculum` already constrains
 * them usefully: a prerequisite must appear strictly earlier in curriculum order,
 * which for a cross-track link means an earlier track, so cycles are impossible.
 *
 * What was missing is the reader's side. "after Database Replication" is
 * unhelpful if you are on a concurrency page and have no idea where that lives,
 * and prerequisites are a SOFT gate whose whole job is orientation. An unknown
 * slug falls back to the raw slug rather than throwing — the check script owns
 * that error, and a lesson page should not blank because of it.
 */
export function prerequisiteLabels(lesson: LessonMeta): string[] {
  const ownTrack = trackByModuleSlug.get(lesson.moduleSlug);
  return lesson.prerequisites.map((slug) => {
    const target = bySlug.get(slug);
    if (!target) return slug;
    const theirTrack = trackByModuleSlug.get(target.moduleSlug);
    return theirTrack && theirTrack !== ownTrack
      ? `${target.title} (${theirTrack.title})`
      : target.title;
  });
}

/** Zero-padded stamp: "track 01". Never hardcode this string in a component. */
export function trackLabel(track: Track): string {
  return `track ${String(trackNumber(track)).padStart(2, "0")}`;
}

/* ---------------------------------------------------------------------------
   Paths
--------------------------------------------------------------------------- */

/** A track's landing page. */
export function trackPath(track: Track): string {
  return `/learn/${track.slug}`;
}

/**
 * Route path for a lesson page: `/learn/<track>/<module>/<slug>`.
 *
 * The track segment is load-bearing, not decoration — it keeps module slugs
 * scoped to their track and makes the URL say which course you are in. The
 * pre-track URLs (`/learn/<module>/<slug>`) are kept alive as redirect stubs
 * by `src/app/learn/[...legacy]/page.tsx`.
 */
export function lessonPath(lesson: LessonMeta): string {
  return `/learn/${trackOfLesson(lesson).slug}/${lesson.moduleSlug}/${lesson.slug}`;
}

/**
 * The ONLY track whose URLs ever had the pre-track shape.
 *
 * Every other track was created after the route migration, so its lessons have
 * no legacy URL and must not get a redirect stub. Exported so the stub generator
 * and the e2e suite share one definition: they had drifted apart, the suite
 * keeping a hand-maintained module exclusion that knew nothing about track 03.
 */
export const MIGRATED_TRACK = "system-design-fundamentals";

/** Lessons that actually have a pre-migration URL, and therefore a stub. */
export function migratedLessons(): LessonMeta[] {
  return allLessons.filter(
    (lesson) =>
      lesson.status === "available" && trackOfLesson(lesson).slug === MIGRATED_TRACK,
  );
}

/** The pre-migration URL for a lesson, kept only to generate redirect stubs. */
export function legacyLessonPath(lesson: LessonMeta): string {
  return `/learn/${lesson.moduleSlug}/${lesson.slug}`;
}

/**
 * Which track a learn-area URL belongs to — the one definition of "active
 * track", so the sidebar, its header stamp, and the mobile drawer cannot
 * disagree.
 *
 * Accepts both URL shapes on purpose: `/learn/<track>/…` (the destination)
 * and `/learn/<module>/<slug>` (the legacy lesson path still in use until the
 * route migration lands). `undefined` means "no track in this URL" — e.g.
 * `/learn` itself, which is the curriculum index.
 */
export function trackFromPathname(pathname: string): Track | undefined {
  const [, learn, first] = pathname.split("/");
  if (learn !== "learn" || !first) return undefined;
  return trackBySlugMap.get(first) ?? trackByModuleSlug.get(first);
}

/* ---------------------------------------------------------------------------
   Navigation

   Prev/next are TRACK-BOUNDED: walking the global flat list would chain the
   last lesson of one track into the first lesson of an unrelated one, which
   reads as a single 180-lesson course rather than eleven tracks. `undefined`
   at a track edge is the signal for the end-of-track card.
--------------------------------------------------------------------------- */

export function nextLesson(slug: string): LessonMeta | undefined {
  const lesson = bySlug.get(slug);
  if (!lesson) return undefined;
  const siblings = lessonsOfTrack(trackOfLesson(lesson));
  const i = siblings.findIndex((l) => l.slug === slug);
  return i >= 0 ? siblings[i + 1] : undefined;
}

export function prevLesson(slug: string): LessonMeta | undefined {
  const lesson = bySlug.get(slug);
  if (!lesson) return undefined;
  const siblings = lessonsOfTrack(trackOfLesson(lesson));
  const i = siblings.findIndex((l) => l.slug === slug);
  return i > 0 ? siblings[i - 1] : undefined;
}

/**
 * A lesson page's `<head>`, derived from the registry.
 *
 * Same rule as the rendered page: titles and taglines live in the registry
 * only, so a lesson route is `export const metadata = lessonMetadata("<slug>")`
 * and never restates its own copy. An unknown slug falls back to the site
 * defaults from the root layout rather than shipping a wrong title.
 */
export function lessonMetadata(slug: string): Metadata {
  const lesson = bySlug.get(slug);
  if (!lesson) return {};

  return {
    title: lesson.title,
    description: lesson.tagline,
    ...shareMetadata({
      title: lesson.title,
      description: lesson.tagline,
      path: lessonPath(lesson),
      type: "article",
      routeImage: true,
    }),
  };
}
