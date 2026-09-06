import { SiteHeader } from "@/components/navigation/SiteChrome";
import { buttonClasses } from "@/components/ui/Button";
import { SectionRule } from "@/components/ui/SectionRule";
import { shareMetadata } from "@/lib/site";
import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

const description =
  "Why syslab is a lab instead of an article: you predict what a system will do, then watch a seeded simulation prove you right or wrong.";

export const metadata: Metadata = {
  title: "About",
  description,
  ...shareMetadata({
    title: "About syslab",
    description,
    path: "/about",
    type: "article",
  }),
};

export default function AboutPage() {
  return (
    <div className="relative min-h-screen">
      <SiteHeader
        width="read"
        nav={
          <Link href="/learn" className="text-sm transition-colors hover:text-fg text-fg-muted">
            Learning path
          </Link>
        }
      />

      <main id="main" className="mx-auto max-w-3xl px-6 py-14">
        <SectionRule className="mb-2">
          <span className="tech-label">about</span>
        </SectionRule>
        <h1 className="font-display mb-8 text-3xl font-bold tracking-tight">
          Learn by manipulating systems, not reading about them.
        </h1>

        <div className="flex flex-col gap-5 leading-relaxed text-fg-muted">
          <p>
            Most material about systems is prose about diagrams: load
            balancing explained in eight paragraphs, a static picture, a
            bullet list of trade-offs. You can read all of it and still have
            no feel for <em className="text-fg">why</em> a queue explodes, or
            what a health-check window costs you. The same gap shows up in a
            WAL, a scheduler, a lexer.
          </p>
          <p>
            syslab inverts that. Every lesson is a running simulation —
            packets you can watch, interleavings you can step, parameters you
            can drag, servers you can kill. The prose frames what you&apos;re
            seeing, not the other way around. You{" "}
            <em className="text-fg">predict</em> what a system will do, then
            the model proves you right or wrong on screen.
          </p>
          <p>
            The curriculum is eleven tracks: system design, concurrency,
            databases, testing, delivery, networking, software design,
            on-call practice, operating systems, security, and language
            runtimes. The name is the method — a lab you break — not a claim
            that every lesson is distributed systems.
          </p>
          <p>
            The simulations are deliberately believable rather than
            academically precise. Enough dynamics to build correct intuition;
            never so much that the model gets in the way. Every run is
            deterministic: restart a lesson and the same seed replays the
            same trace, so a prediction you got wrong can be rewound and
            watched twice.
          </p>
        </div>

        <h2 className="font-display mt-12 mb-4 text-xl font-bold">Colophon</h2>
        <p className="text-sm leading-relaxed text-fg-muted">
          Built with Next.js, React, Tailwind, and Motion. Two engines, both
          seeded: a fixed-timestep packet loop (128 pooled dots) and a
          discrete-step player that can walk backward. Progress lives in
          your browser&apos;s localStorage; there is no account and no
          server.
        </p>

        <Link href="/learn" className={buttonClasses("primary", "md", "mt-12")}>
          Open the curriculum
          <ArrowRight className="size-4" />
        </Link>
      </main>
    </div>
  );
}
