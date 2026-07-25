import { curriculum } from "@/curriculum/registry";
import type { LessonMeta, Module, Track } from "@/curriculum/types";
import { shareMetadata } from "@/lib/site";
import type { Metadata } from "next";

/** v1 has a single track; helpers assume it. */
export const track: Track = curriculum.tracks[0];

export const modules: Module[] = track.modules;

/** All lessons in curriculum order (module order → lesson order). */
export const allLessons: LessonMeta[] = modules.flatMap((m) => m.lessons);

const bySlug = new Map(allLessons.map((l) => [l.slug, l]));
const moduleBySlug = new Map(modules.map((m) => [m.slug, m]));

export function getLesson(slug: string): LessonMeta | undefined {
  return bySlug.get(slug);
}

export function getModule(slug: string): Module | undefined {
  return moduleBySlug.get(slug);
}

export function moduleOf(lesson: LessonMeta): Module {
  // Registry guarantees every lesson's moduleSlug resolves.
  return moduleBySlug.get(lesson.moduleSlug)!;
}

/** Route path for a lesson page. */
export function lessonPath(lesson: LessonMeta): string {
  return `/learn/${lesson.moduleSlug}/${lesson.slug}`;
}

export function nextLesson(slug: string): LessonMeta | undefined {
  const i = allLessons.findIndex((l) => l.slug === slug);
  return i >= 0 ? allLessons[i + 1] : undefined;
}

export function prevLesson(slug: string): LessonMeta | undefined {
  const i = allLessons.findIndex((l) => l.slug === slug);
  return i > 0 ? allLessons[i - 1] : undefined;
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
