import { getLesson, moduleOf } from "@/lib/curriculum";
import { shareCardAlt, siteName } from "@/lib/site";
import type { Accent } from "@/curriculum/types";
import { ImageResponse } from "next/og";

/**
 * The per-lesson share card factory.
 *
 * Same contract as the site card in `src/app/opengraph-image.tsx`: rendered
 * once at build time (static export has no server to render it on demand),
 * and only with the typefaces next/og bundles — the build has no network, so
 * nothing here may fetch a font.
 *
 * A lesson route wires it up in four lines (see any
 * `src/app/learn/<module>/<slug>/opengraph-image.tsx`):
 *
 *     import { lessonOg } from "@/lib/og";
 *     const og = lessonOg("caching");
 *     export const { alt, size, contentType, dynamic } = og;
 *     export default og.image;
 *
 * Copy still lives in the registry only — the card reads title, tagline,
 * module, difficulty and minutes from it, exactly like the page does.
 *
 * The file convention is what makes the card exist at
 * `<lesson route>/opengraph-image`; the `<meta>` tag that points there is
 * written by `shareMetadata({ routeImage: true })` in src/lib/site.ts, which
 * explains why the URL is stated rather than auto-injected.
 */

export const ogSize = { width: 1200, height: 630 };
export const ogContentType = "image/png";
export const ogDynamic = "force-static";

/**
 * Card palette. Satori has no CSS custom properties, so the design tokens are
 * inlined as hex — sRGB stand-ins for the `@theme` oklch Arctic tokens in
 * globals.css. The card sits on a slightly lifted Polar Night surface
 * (#2e3440) so faint text stays readable.
 *
 * Keep in sync with src/app/opengraph-image/route.tsx.
 */
const BG = "#2e3440";
const FG = "#eceff4";
const MUTED = "#d8dee9";
const FAINT = "#8a93a6";

/** Module accent → the same hue `accentCssVar` resolves to, as hex. */
const ACCENT_HEX: Record<Accent, string> = {
  amber: "#88c0d0", // brand frost (legacy key = scaling module)
  violet: "#b48ead",
  cyan: "#81a1c1",
  green: "#a3be8c",
  red: "#bf616a",
};

/**
 * Titles run from "Caching" to "Delivery Guarantees & Idempotency". One size
 * would either shrink the short ones or wrap the long ones three deep, so the
 * display size steps down with length; two lines still clear the footer.
 */
function titleSize(title: string): number {
  if (title.length <= 16) return 88;
  if (title.length <= 26) return 78;
  if (title.length <= 34) return 68;
  return 60;
}

/** The lesson the card describes, or a loud build-time failure. */
function requireLesson(slug: string) {
  const lesson = getLesson(slug);
  if (!lesson) {
    throw new Error(
      `og: unknown lesson slug "${slug}" — opengraph-image.tsx must name a slug that exists in the curriculum registry.`,
    );
  }
  return lesson;
}

/** `og:image:alt` for a lesson card — the same string the page's metadata uses. */
export function lessonOgAlt(slug: string): string {
  const lesson = requireLesson(slug);
  return shareCardAlt(lesson.title, lesson.tagline);
}

/** The `opengraph-image.tsx` default export for one lesson. */
export function lessonOgImage(slug: string) {
  return async function LessonOpengraphImage() {
    const lesson = requireLesson(slug);
    const lessonModule = moduleOf(lesson);
    const hue = ACCENT_HEX[lessonModule.accent];

    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            background: BG,
            padding: "68px 76px",
            color: FG,
            borderTop: `6px solid ${hue}`,
          }}
        >
          {/* kicker — wordmark, then where this lesson sits */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              width: "100%",
              fontSize: 26,
              letterSpacing: 4,
              textTransform: "uppercase",
              color: FAINT,
            }}
          >
            <span style={{ color: FG, letterSpacing: 2 }}>{siteName}</span>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 10,
                background: hue,
                marginLeft: 10,
                marginTop: 10,
              }}
            />
            <span style={{ marginLeft: 18, color: hue }}>
              {lessonModule.title}
            </span>
            <span style={{ marginLeft: "auto", fontSize: 22 }}>
              {lesson.difficulty}
            </span>
          </div>

          {/* the lesson itself */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                display: "flex",
                fontSize: titleSize(lesson.title),
                lineHeight: 1.05,
              }}
            >
              {lesson.title}
            </div>
            <div
              style={{
                width: 190,
                height: 5,
                background: hue,
                marginTop: 34,
                marginBottom: 34,
              }}
            />
            <div
              style={{
                display: "flex",
                maxWidth: 880,
                fontSize: 30,
                lineHeight: 1.35,
                color: MUTED,
              }}
            >
              {lesson.tagline}
            </div>
          </div>

          {/* footer */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              width: "100%",
              fontSize: 25,
              color: FAINT,
              letterSpacing: 1,
            }}
          >
            <span>
              interactive simulation · {lesson.estimatedMinutes} min
            </span>
            <span style={{ marginLeft: "auto" }}>
              drag it · break it · predict it
            </span>
          </div>
        </div>
      ),
      { ...ogSize },
    );
  };
}

/**
 * Everything one lesson route's `opengraph-image.tsx` exports, from a single
 * call — so the slug is written once per file and the file-convention exports
 * (`alt`, `size`, `contentType`, `dynamic`) cannot drift between routes.
 */
export function lessonOg(slug: string): {
  alt: string;
  size: { width: number; height: number };
  contentType: string;
  dynamic: "force-static";
  image: () => Promise<ImageResponse>;
} {
  return {
    alt: lessonOgAlt(slug),
    size: ogSize,
    contentType: ogContentType,
    dynamic: ogDynamic,
    image: lessonOgImage(slug),
  };
}
