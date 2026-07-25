import { allLessons } from "@/lib/curriculum";
import { siteTitle } from "@/lib/site";
import { ImageResponse } from "next/og";

/**
 * The share card, rendered once at build time (static export has no server to
 * render it on demand). Fonts are the ones next/og bundles — the build runs
 * without network access, so nothing here may fetch a typeface.
 */
export const dynamic = "force-static";
export const alt = siteTitle;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BG = "#1a1712";
const AMBER = "#f0b135";
const FG = "#eee6da";
const FAINT = "#8a8075";

export default function OpengraphImage() {
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
          borderTop: `6px solid ${AMBER}`,
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
              background: AMBER,
              marginLeft: 10,
              marginTop: 10,
            }}
          />
          <span style={{ marginLeft: "auto", fontSize: 22 }}>
            track 01 · {live} live simulations
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
              color: AMBER,
            }}
          >
            breaking them.
          </div>
          <div
            style={{
              width: 190,
              height: 5,
              background: AMBER,
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
