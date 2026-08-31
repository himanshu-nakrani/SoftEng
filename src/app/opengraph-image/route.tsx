import { allLessons, firstTrack, trackLabel, tracks } from "@/lib/curriculum";
import { ImageResponse } from "next/og";

/**
 * The site-wide share card, rendered once at build time (static export has no
 * server to render it on demand). Fonts are the ones next/og bundles — the
 * build runs without network access, so nothing here may fetch a typeface.
 *
 * A ROUTE HANDLER, deliberately not the `opengraph-image.tsx` file convention:
 * the convention auto-injects its own og:image URL built as basePath joined
 * onto a metadataBase that already carries the base path — a doubled
 * `/SoftEng/SoftEng/...` 404 on the Pages deploy — and a layout-level explicit
 * `openGraph.images` does NOT suppress that injection (page-level ones do,
 * which is why the per-lesson cards are safe). Serving the same PNG from a
 * handler keeps the URL, kills the injection, and lets the layout's explicit
 * entry be the only tag emitted.
 */
export const dynamic = "force-static";

const size = { width: 1200, height: 630 };

/**
 * Inlined tokens — Satori has no CSS custom properties. Derived by converting
 * the `@theme` oklch values in globals.css to sRGB, not eyeballed:
 *   --color-raised oklch(20% 0.014 70) → #1a150f  (lifted, so faint text reads)
 *   --color-accent oklch(80% 0.15 80)  → #f0b135
 *   --color-fg     oklch(93% 0.008 80) → #ebe7e2
 *   --color-fg-faint oklch(60% 0.014 75) → #857f77
 *
 * Keep in sync with src/lib/og.tsx, src/app/icon.svg and manifest.webmanifest.
 */
const BG = "#1a150f";
const ACCENT = "#f0b135";
const FG = "#ebe7e2";
const FAINT = "#857f77";

export function GET() {
  const live = allLessons.filter((l) => l.status === "available").length;

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
          borderTop: `6px solid ${ACCENT}`,
        }}
      >
        {/* wordmark row */}
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
          <span style={{ color: FG, letterSpacing: 2 }}>syslab</span>
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 10,
              background: ACCENT,
              marginLeft: 10,
              marginTop: 10,
            }}
          />
          <span style={{ marginLeft: "auto", fontSize: 22 }}>
            {tracks.length === 1
              ? `${trackLabel(firstTrack)} · ${live} live simulations`
              : `${tracks.length} tracks · ${live} live simulations`}
          </span>
        </div>

        {/* headline — the site's real h1 */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 92, lineHeight: 1.05 }}>
            Learn systems by
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 92,
              lineHeight: 1.05,
              color: ACCENT,
            }}
          >
            breaking them.
          </div>
          <div
            style={{
              width: 190,
              height: 5,
              background: ACCENT,
              marginTop: 38,
            }}
          />
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
          <span>interactive system design</span>
          <span style={{ marginLeft: "auto" }}>
            drag it · break it · predict it
          </span>
        </div>
      </div>
    ),
    { ...size },
  );
}
