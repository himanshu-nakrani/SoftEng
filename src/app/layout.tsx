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
import localFont from "next/font/local";
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

// Self-hosted Latin subsets keep the same visual system while ensuring a
// GitHub Pages export never depends on a build-time Google Fonts request.
const bricolage = localFont({
  src: "./fonts/bricolage-grotesque-latin.woff2",
  weight: "200 800",
  variable: "--font-bricolage",
  display: "swap",
});

// Plex Sans is a variable source covering the weights used by body copy and
// interface text. Keeping the range avoids synthetic bolds in future content.
const plexSans = localFont({
  src: "./fonts/ibm-plex-sans-latin.woff2",
  weight: "400 700",
  variable: "--font-plex-sans",
  display: "swap",
});

// Plex Mono is static, so the two shipped interface weights stay explicit.
const plexMono = localFont({
  src: [
    { path: "./fonts/ibm-plex-mono-400-latin.woff2", weight: "400" },
    { path: "./fonts/ibm-plex-mono-500-latin.woff2", weight: "500" },
  ],
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
  themeColor: "#f7f6f1",
  colorScheme: "light dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(() => { try { const root = document.documentElement; const saved = localStorage.getItem('syslab-appearance'); const theme = saved === 'dark' || saved === 'light' ? saved : (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); root.dataset.theme = theme; root.classList.toggle('dark', theme === 'dark'); const accent = localStorage.getItem('syslab-accent'); if (/^#[0-9a-f]{6}$/i.test(accent || '')) { const value = accent; const n = (i) => parseInt(value.slice(i, i + 2), 16) / 255; const linear = (v) => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; const l = .2126 * linear(n(1)) + .7152 * linear(n(3)) + .0722 * linear(n(5)); root.style.setProperty('--user-accent', value); root.style.setProperty('--color-accent', value); root.style.setProperty('--color-accent-dim', `color-mix(in srgb, ${value} 14%, transparent)`); root.style.setProperty('--color-accent-ink', l > .34 ? '#10201f' : '#fffdf7'); } const size = localStorage.getItem('syslab-reading-size'); if (size === 'compact' || size === 'default' || size === 'comfortable') root.dataset.readingSize = size; } catch {} })();",
          }}
        />
      </head>
      <body
        className={`${bricolage.variable} ${plexSans.variable} ${plexMono.variable} font-sans antialiased`}
      >
        {/* Keyboard-only escape hatch past the nav; invisible until focused. */}
        <a
          href="#main"
          className="sr-only rounded-md font-semibold focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[200] focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:text-accent-ink"
        >
          Skip to content
        </a>
        {children}
        <RegisterSW basePath={basePath} />
      </body>
    </html>
  );
}
