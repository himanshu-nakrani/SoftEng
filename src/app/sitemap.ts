import { allLessons, lessonPath } from "@/lib/curriculum";
import { absoluteUrl } from "@/lib/site";
import type { MetadataRoute } from "next";

/** Static export: emitted to out/sitemap.xml at build time. */
export const dynamic = "force-static";

/**
 * Registry-driven — a lesson appears here the moment its `status` flips to
 * "available", and never before (coming-soon lessons have no route to crawl).
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    {
      url: absoluteUrl("/"),
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: absoluteUrl("/learn"),
      lastModified,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: absoluteUrl("/review"),
      lastModified,
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: absoluteUrl("/about"),
      lastModified,
      changeFrequency: "yearly",
      priority: 0.4,
    },
    ...allLessons
      .filter((lesson) => lesson.status === "available")
      .map((lesson) => ({
        url: absoluteUrl(lessonPath(lesson)),
        lastModified,
        changeFrequency: "monthly" as const,
        priority: 0.8,
      })),
  ];
}
