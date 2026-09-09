import { LegacyRedirect } from "@/components/navigation/LegacyRedirect";
import { allLessons, lessonPath, migratedLessons } from "@/lib/curriculum";
import type { Metadata } from "next";

/**
 * Redirect stubs for the pre-track lesson URLs.
 *
 * Lessons used to live at `/learn/<module>/<slug>`; they now live at
 * `/learn/<track>/<module>/<slug>`. A static export has no server, so there is
 * nothing to issue a 301 — the only honest options are a generated page per old
 * URL or dead links in every bookmark, README, and shared card already out
 * there. This is that page, generated from the registry so it can never drift
 * from the set of lessons that actually moved.
 *
 * `dynamicParams = false` keeps this from swallowing arbitrary 404s: only the
 * paths enumerated below exist, everything else falls through to not-found.
 *
 * Static segments outrank catch-alls in Next's route ranking, so the real
 * lesson routes under `/learn/system-design-fundamentals/…` are unaffected.
 */
export const dynamicParams = false;

/**
 * The pre-track track. Only lessons that ACTUALLY lived at
 * `/learn/<module>/<slug>` need a stub; a lesson shipped after the migration
 * never had that URL, and minting one would publish a phantom duplicate of
 * every new lesson forever.
 */

export function generateStaticParams() {
  return migratedLessons().map((lesson) => ({
    legacy: [lesson.moduleSlug, lesson.slug],
  }));
}

export const metadata: Metadata = {
  // A redirect stub must never compete with its own destination in search.
  robots: { index: false, follow: true },
};

export default async function LegacyLessonPage({
  params,
}: {
  params: Promise<{ legacy: string[] }>;
}) {
  const { legacy } = await params;
  const slug = legacy[legacy.length - 1];
  const lesson = allLessons.find((l) => l.slug === slug);

  // generateStaticParams only emits real lessons, so this is unreachable in a
  // build; it exists so the component is total rather than asserting.
  if (!lesson) return null;

  return <LegacyRedirect href={lessonPath(lesson)} title={lesson.title} />;
}
