import type { Metadata } from "next";

/**
 * Site-level identity + the one place the public origin is decided.
 *
 * The deploy target is not final, so the origin is env-driven:
 * `NEXT_PUBLIC_SITE_URL` wins, otherwise the current GitHub Pages project
 * site. Set it to the full public origin **including any base path** — GitHub
 * Pages project sites live under `/<repo>`, which is exactly what `BASE_PATH`
 * feeds to `basePath` in next.config.ts. Keeping the path on the origin means
 * `metadataBase`, canonicals, the sitemap and robots.txt all agree with the
 * URLs the host actually serves.
 */
export const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ??
  "https://himanshu-nakrani.github.io/SoftEng"
).replace(/\/+$/, "");

export const siteName = "syslab";

export const siteTitle = "syslab — learn systems by breaking them";

export const siteDescription =
  "Interactive system design lessons. Watch requests flow, drag the sliders, kill the servers — learn how large-scale systems actually behave.";

/** Absolute URL for a root-relative route (`/learn/scaling/client-server`). */
export function absoluteUrl(path: string): string {
  if (path === "/") return `${siteUrl}/`;
  return `${siteUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * The build-time share card (src/app/opengraph-image.tsx). Relative on
 * purpose: Next resolves it against `metadataBase`, so it picks up the base
 * path automatically.
 */
export const ogImage = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: siteTitle,
  type: "image/png",
} as const;

/**
 * The card a route renders from its own `opengraph-image.tsx`, addressed the
 * same relative way as `ogImage` above.
 *
 * Next's file convention also *auto-injects* this image — but only into a
 * segment whose metadata leaves `openGraph.images` unset, and it builds the
 * URL as `basePath + segment` resolved against `metadataBase`. Since
 * `metadataBase` here already carries the base path (see `siteUrl`), that
 * auto-injected URL comes out doubled (`/SoftEng/SoftEng/...`) on the Pages
 * build. Naming the image explicitly keeps every share URL going through the
 * one resolution rule this file documents, at both base paths.
 */
export function ogImageFor(page: { path: string; alt: string }) {
  return {
    url: `${page.path}/opengraph-image`,
    width: 1200,
    height: 630,
    alt: page.alt,
    type: "image/png",
  } as const;
}

/**
 * Alt text for a route's own share card. Lives here rather than beside the
 * renderer so the `<meta>` value and the image module's `alt` export (see
 * src/lib/og.tsx) are the same string by construction.
 */
export function shareCardAlt(title: string, description: string): string {
  return `${siteName} — ${title}: ${description}`;
}

/**
 * The canonical + social block for one page.
 *
 * Next merges metadata per *key*, not deeply: a route that declares
 * `openGraph` replaces the layout's entire object — including the og:image
 * the file-based opengraph-image contributes, and the same goes for
 * `twitter`. So any page that customises its share card has to restate the
 * whole block. This is that block, in one place.
 */
export function shareMetadata(page: {
  title: string;
  description: string;
  /** Root-relative route, e.g. "/learn/data/caching". */
  path: string;
  type?: "website" | "article";
  /**
   * Set by routes that ship their own `opengraph-image.tsx` — the block then
   * points at that card instead of the site-wide one. See `ogImageFor` for
   * why the URL is stated rather than left to Next's auto-injection.
   */
  routeImage?: boolean;
}): Metadata {
  const url = absoluteUrl(page.path);
  const images = {
    images: [
      page.routeImage
        ? ogImageFor({
            path: page.path,
            alt: shareCardAlt(page.title, page.description),
          })
        : ogImage,
    ],
  };

  return {
    alternates: { canonical: url },
    openGraph: {
      type: page.type ?? "article",
      siteName,
      locale: "en_US",
      title: page.title,
      description: page.description,
      url,
      ...images,
    },
    twitter: {
      card: "summary_large_image",
      title: page.title,
      description: page.description,
      ...images,
    },
  };
}
