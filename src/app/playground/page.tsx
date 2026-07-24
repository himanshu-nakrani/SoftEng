import { PlaygroundClient } from "@/components/playground/PlaygroundClient";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Playground",
  description:
    "Free-play sandbox for every syslab simulation — no script, no quizzes, all the sliders. Share exact runs via URL.",
};

export default function PlaygroundPage() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-5">
        <Link href="/" className="flex items-baseline gap-1">
          <span className="font-display text-xl font-bold tracking-tight">
            syslab
          </span>
          <span className="size-1.5 rounded-full bg-accent shadow-[0_0_6px_var(--color-accent)]" />
        </Link>
        <span className="tech-label">{"// playground"}</span>
        <nav className="ml-auto flex items-center gap-5 text-sm text-fg-muted">
          <Link href="/learn" className="transition-colors hover:text-fg">
            Learning path
          </Link>
          <Link href="/about" className="transition-colors hover:text-fg">
            About
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {/* useSearchParams requires a Suspense boundary for static export */}
        <Suspense>
          <PlaygroundClient />
        </Suspense>
      </main>
    </div>
  );
}
