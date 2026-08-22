import { PlaygroundClient } from "@/components/playground/PlaygroundClient";
import { SiteHeader } from "@/components/navigation/SiteChrome";
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
      <SiteHeader
        nav={
          <>
            <span className="tech-label mr-5 hidden sm:inline">
              {"// playground"}
            </span>
            <Link href="/learn" className="text-sm transition-colors hover:text-fg text-fg-muted">
              Learning path
            </Link>
            <Link href="/about" className="text-sm transition-colors hover:text-fg text-fg-muted">
              About
            </Link>
          </>
        }
      />

      <main className="mx-auto max-w-6xl px-6 py-8">
        {/* useSearchParams requires a Suspense boundary for static export */}
        <Suspense>
          <PlaygroundClient />
        </Suspense>
      </main>
    </div>
  );
}
