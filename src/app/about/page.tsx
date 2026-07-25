import { shareMetadata } from "@/lib/site";
import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

const description =
  "Why syslab is a simulator instead of an article: you predict what a system will do, then watch it prove you right or wrong.";

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
      <header className="mx-auto flex max-w-2xl items-center gap-6 px-6 py-5">
        <Link href="/" className="flex items-baseline gap-1">
          <span className="font-display text-xl font-bold tracking-tight">
            syslab
          </span>
          <span className="size-1.5 rounded-full bg-accent shadow-[0_0_6px_var(--color-accent)]" />
        </Link>
        <nav className="ml-auto flex gap-5 text-sm text-fg-muted">
          <Link href="/learn" className="transition-colors hover:text-fg">
            Learning path
          </Link>
        </nav>
      </header>

      <main id="main" className="mx-auto max-w-2xl px-6 py-14">
        <p className="tech-label mb-2">about</p>
        <h1 className="font-display mb-8 text-3xl font-bold tracking-tight">
          Learn by manipulating systems, not reading about them.
        </h1>

        <div className="flex flex-col gap-5 leading-relaxed text-fg-muted">
          <p>
            Most system design material is prose about diagrams: load
            balancing explained in eight paragraphs, a static picture, a
            bullet list of trade-offs. You can read all of it and still have
            no feel for <em className="text-fg">why</em> a queue explodes, or
            what a health-check window costs you.
          </p>
          <p>
            syslab inverts that. Every lesson is built around a running
            simulation — request packets you can watch, parameters you can
            drag, servers you can kill. The prose exists to frame what
            you&apos;re seeing, not the other way around. You{" "}
            <em className="text-fg">predict</em> what a system will do, then
            the simulation proves you right or wrong on screen.
          </p>
          <p>
            The simulations are deliberately believable rather than
            academically precise — no queueing theory, just honest dynamics:
            bounded queues, probabilistic arrivals, service capacity, failure
            and recovery. Enough to build correct intuition; never so much
            that the model gets in the way.
          </p>
          <p>
            Every run is deterministic. Restart a lesson and the same seed
            replays the exact same traffic — so when a prediction quiz tells
            you the error burst is coming, you can rewind and watch it land
            the same way twice.
          </p>
        </div>

        <h2 className="font-display mt-12 mb-4 text-xl font-bold">Colophon</h2>
        <p className="text-sm leading-relaxed text-fg-muted">
          Built with Next.js, React, Tailwind, and Motion. The simulation
          engine is hand-rolled SVG — a fixed-timestep loop, a pool of 128
          packet dots, and seeded randomness. Progress lives entirely in your
          browser&apos;s localStorage; there is no account and no server.
        </p>

        <Link
          href="/learn"
          className="mt-12 inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-bg transition-all hover:brightness-110"
        >
          Start the track
          <ArrowRight className="size-4" />
        </Link>
      </main>
    </div>
  );
}
