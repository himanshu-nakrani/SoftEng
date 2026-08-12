import { RegisterSW } from "@/components/RegisterSW";
import {
  absoluteUrl,
  ogImage,
  siteDescription,
  siteName,
  siteTitle,
  siteUrl,
} from "@/lib/site";
import type { Metadata, Viewport } from "next";
import {
  Bricolage_Grotesque,
  IBM_Plex_Mono,
  IBM_Plex_Sans,
} from "next/font/google";
import "./globals.css";

/**
 * Same normalisation as next.config.ts — `/SoftEng`, `SoftEng` and `/SoftEng/`
 * all collapse to `/SoftEng`, and an unset variable to `""`.
 *
 * Restated here rather than imported because next.config.ts is not part of the
 * app's module graph. `BASE_PATH` is what the deploy job and next.config.ts
 * agree on; `NEXT_PUBLIC_BASE_PATH` is accepted as the alias the CI workflow
 * also exports. This is a server component, so both are readable at build time
 * and neither leaks into the client bundle except as the string prop below.
 */
const rawBasePath = (
  process.env.BASE_PATH ??
  process.env.NEXT_PUBLIC_BASE_PATH ??
  ""
).trim();
const basePath = rawBasePath
  ? `/${rawBasePath.replace(/^\/+/, "").replace(/\/+$/, "")}`
  : "";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
});

// 700 is currently unused — every `font-bold` in the app sits on a
// `font-display` element — but it stays. Google serves Plex Sans as a variable
// font, so all four weights resolve to the *same* six woff2 files: dropping 700
// removes six `@font-face` lines and zero bytes, while making the next
// `font-bold` on a sans element synthesise a fake bold from 600.
const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-sans",
  display: "swap",
});

// Plex Mono is not variable: each requested weight is a distinct resource.
// Interface labels use only regular and medium weights, so omitting 600 avoids
// shipping an unused face on every static route. Italics are omitted as well.
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});

/**
 * Site-wide `<head>`. `metadataBase` resolves every relative URL a page or
 * file-convention asset (icon, opengraph-image) produces, so it has to carry
 * the base path the host serves from — see src/lib/site.ts.
 */
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: siteTitle,
    template: `%s · ${siteName}`,
  },
  description: siteDescription,
  applicationName: siteName,
  alternates: { canonical: absoluteUrl("/") },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  creator: siteName,
  publisher: siteName,
  referrer: "strict-origin-when-cross-origin",
  // Unlike icons and OG images, Next emits `manifest` verbatim — it is not
  // resolved against `metadataBase`. So it has to carry the base path itself,
  // and it cannot be document-relative: `manifest.webmanifest` on
  // /learn/scaling/client-server would resolve to /learn/scaling/.
  manifest: `${basePath}/manifest.webmanifest`,
  keywords: [
    "system design",
    "distributed systems",
    "interactive simulation",
    "scalability",
    "caching",
    "load balancing",
    "learn by doing",
    "software engineering education",
    "system architecture course",
    "distributed systems course",
    "observability training",
    "resilience engineering",
  ],
  category: "education",
  openGraph: {
    type: "website",
    siteName,
    title: siteTitle,
    description: siteDescription,
    url: absoluteUrl("/"),
    locale: "en_US",
    // Explicit rather than file-injected: auto-injection joins basePath onto
    // a metadataBase that already carries it, doubling the prefix on Pages.
    images: [ogImage],
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
    images: [ogImage],
  },
};

export const viewport: Viewport = {
  themeColor: "#2e3440",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${bricolage.variable} ${plexSans.variable} ${plexMono.variable} font-sans antialiased`}
      >
        {/* Keyboard-only escape hatch past the nav; invisible until focused. */}
        <a
          href="#main"
          className="sr-only rounded-md font-semibold focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[200] focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:text-bg"
        >
          Skip to content
        </a>
        {children}
        <RegisterSW basePath={basePath} />
      </body>
    </html>
  );
}
