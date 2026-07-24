import { curriculum } from "@/curriculum/registry";
import type { LessonMeta, Module, Track } from "@/curriculum/types";

export const tracks: Track[] = curriculum.tracks;

/** All modules across every track, in curriculum order. */
export const modules: Module[] = tracks.flatMap((t) => t.modules);

/** All lessons in curriculum order (track → module → lesson). */
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

export function trackOf(module: Module): Track {
  return tracks.find((t) => t.modules.includes(module))!;
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
