import { ContinueCta } from "@/components/landing/ContinueCta";
import { HeroSim } from "@/components/landing/HeroSim";
import { Vignettes } from "@/components/landing/Vignettes";
import { SiteFooter, SiteHeader } from "@/components/navigation/SiteChrome";
import { CornerTicks } from "@/components/ui/CornerTicks";
import { buttonClasses } from "@/components/ui/Button";
import { PlateLabel } from "@/components/ui/PlateLabel";
import { SectionRule } from "@/components/ui/SectionRule";
import { accentCssVar } from "@/lib/accent";
import { allLessons, modules, track } from "@/lib/curriculum";
import { absoluteUrl, siteDescription, siteName } from "@/lib/site";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

/** Landing nav — the status readout is marginalia and lives at the edge. */
function LandingNav() {
  return (
    <>
      <span className="tech-label hidden items-center gap-1.5 sm:flex">
        <span className="size-1.5 animate-pulse rounded-full bg-glow-green" />
        all systems nominal
      </span>
      <Link href="/learn" className="text-sm transition-colors hover:text-fg text-fg-muted">
        Learning path
      </Link>
      <Link href="/about" className="text-sm transition-colors hover:text-fg text-fg-muted">
        About
      </Link>
    </>
  );
}

/** Hairline rule with a mono index — the section divider language. */
function LedgerRule({ n, label }: { n: string; label: string }) {
  return (
    <SectionRule className="mb-8">
      <span className="tech-num text-xs text-fg-faint">{n}</span>
      <span className="tech-label text-accent">{label}</span>
    </SectionRule>
  );
}

export default function Home() {
  // Every count on this page is derived — the registry is the only source of
  // truth, so shipping a lesson updates the copy for free.
  const availableCount = allLessons.filter(
    (l) => l.status === "available",
  ).length;
  const allLive = availableCount === allLessons.length;
  const totalMinutes = allLessons
    .filter((lesson) => lesson.status === "available")
    .reduce((sum, lesson) => sum + lesson.estimatedMinutes, 0);
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${absoluteUrl("/")}#website`,
        name: siteName,
        url: absoluteUrl("/"),
        description: siteDescription,
        inLanguage: "en-US",
      },
      {
        "@type": "Organization",
        "@id": `${absoluteUrl("/")}#organization`,
        name: siteName,
        url: absoluteUrl("/"),
      },
      {
        "@type": "Course",
        "@id": `${absoluteUrl("/learn")}#course`,
        name: track.title,
        description:
          "A self-paced interactive course in system design, distributed systems, data infrastructure, resilience, and observability.",
        url: absoluteUrl("/learn"),
        inLanguage: "en-US",
        educationalLevel: "Beginner to advanced",
        timeRequired: `PT${totalMinutes}M`,
        provider: { "@id": `${absoluteUrl("/")}#organization` },
        hasPart: modules.map((module, index) => ({
          "@type": "Course",
          position: index + 1,
          name: module.title,
          description: module.description,
          numberOfItems: module.lessons.filter(
            (lesson) => lesson.status === "available",
          ).length,
        })),
      },
    ],
  };

  return (
    <div className="relative">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
        }}
      />
      <div className="dot-grid dot-grid-fade pointer-events-none absolute inset-x-0 top-0 -z-10 h-[90vh]" />
      <SiteHeader nav={<LandingNav />} />

      {/* Skip-link target: the header above and the footer below stay outside,
          so "skip to content" lands past the nav on the hero. */}
      <main id="main">
        {/* ---- hero: the product, running ---- */}
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 pt-16 pb-28 lg:grid-cols-[1fr_1.05fr]">
          <div>
            <div className="mb-5 flex items-center gap-3 font-mono text-[10px] tracking-[0.18em] text-fg-faint uppercase">
              <span className="text-accent">syslab / interactive systems</span>
              <span className="h-px w-10 bg-border-bright" />
              <span>01</span>
            </div>
            <h1 className="hero-copy font-display mb-6 text-[2.7rem] leading-[1.02] font-bold tracking-tight text-balance sm:text-6xl lg:text-[4.2rem]">
              Learn systems by{" "}
              <span className="text-outline">breaking</span> them.
            </h1>
            <p className="mb-8 max-w-md leading-relaxed text-fg-muted">
              Not another wall of text. Every concept is a running simulation —
              drag the sliders, watch the packets, kill the servers, and build
              the intuition articles can&apos;t give you.
            </p>
            <div className="mb-10 flex flex-wrap items-center gap-3">
              <ContinueCta />
              <Link href="/about" className={buttonClasses("outline", "md")}>
                How it works
              </Link>
            </div>
            <p className="font-mono text-xs leading-relaxed text-fg-faint">
              <span className="text-glow-green">&gt;</span> {availableCount} live
              simulations across {modules.length} modules · seeded &amp;
              deterministic · no account, no server
              <span className="caret-blink ml-1 inline-block h-3 w-1.5 translate-y-0.5 bg-accent" />
            </p>
          </div>

          <div className="relative">
            <div
              className="glow-blob absolute inset-0 -z-10"
              style={{ ["--glow-color" as string]: "var(--color-accent)" }}
            />
            <div className="relative">
              <CornerTicks inset={0} />
              <PlateLabel className="absolute top-1.5 right-4">
                fig · 00 — lb-cluster · self-healing
              </PlateLabel>
              <HeroSim />
            </div>
            {/* plate marginalia — specimen count left, the invitation right */}
            <div className="mt-1.5 flex items-center justify-between">
              <PlateLabel>specimens · {availableCount} live sims</PlateLabel>
              <p className="tech-label">☠ this is live — click a server</p>
            </div>
          </div>
        </section>

        {/* ---- the four verbs: numbered ledger ---- */}
        <section className="mx-auto max-w-6xl px-6 pb-28">
          <LedgerRule n="01" label="the method" />
          <h2 className="font-display mb-8 text-2xl font-bold tracking-tight sm:text-3xl">
            Observe. Manipulate. Predict. Break.
          </h2>
          <Vignettes />
        </section>

        {/* ---- the track: a manifest, not a card grid ---- */}
        <section className="mx-auto max-w-6xl px-6 pb-28">
          <LedgerRule n="02" label="track 01" />
          <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
            <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
              {track.title}
            </h2>
            <p className="tech-num text-xs text-fg-faint">
              {allLive
                ? `${allLessons.length} lessons · ${modules.length} modules`
                : `${availableCount}/${allLessons.length} lessons live`}
            </p>
          </div>

          <div>
            {modules.map((mod, i) => {
              const live = mod.lessons.filter(
                (l) => l.status === "available",
              ).length;
              return (
                <Link
                  key={mod.slug}
                  href={`/learn#${mod.slug}`}
                  className="module-row group relative grid items-baseline gap-x-8 gap-y-2 py-6 md:grid-cols-[110px_240px_1fr_auto]"
                >
                  <span
                    className="absolute top-0 bottom-0 left-0 w-0.5 opacity-0 transition-opacity group-hover:opacity-100"
                    style={{ background: accentCssVar[mod.accent] }}
                  />
                  <span className="tech-num pl-4 text-xs text-fg-faint md:pl-0">
                    <span
                      className="mr-2 inline-block size-1.5 rounded-full align-middle"
                      style={{
                        background: accentCssVar[mod.accent],
                        boxShadow: `0 0 6px ${accentCssVar[mod.accent]}`,
                      }}
                    />
                    mod.{String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="font-display pl-4 text-lg font-semibold md:pl-0">
                    {mod.title}
                  </span>
                  <span className="pl-4 font-mono text-xs leading-relaxed text-fg-muted md:pl-0">
                    {mod.lessons.map((l) => l.title).join("  ·  ")}
                  </span>
                  <span className="tech-num pl-4 text-xs whitespace-nowrap text-fg-faint transition-colors group-hover:text-fg-muted md:pl-0">
                    {live === mod.lessons.length
                      ? `${live} lesson${live === 1 ? "" : "s"}`
                      : `${live}/${mod.lessons.length} live`}{" "}
                    <ArrowRight className="ml-1 inline size-3 -translate-y-px transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      </main>

      <SiteFooter width="app" className="border-t border-border">
        <p className="font-mono text-xs text-fg-faint">
          syslab — learn systems by breaking them
          <span className="mx-3 text-border-bright">·</span>
          no production servers were harmed
        </p>
        <nav aria-label="Footer" className="ml-auto flex gap-5 text-xs text-fg-muted">
          <Link href="/learn" className="transition-colors hover:text-fg">
            Learning path
          </Link>
          <Link href="/about" className="transition-colors hover:text-fg">
            About
          </Link>
        </nav>
      </SiteFooter>
    </div>
  );
}
