import { SiteHeader } from "@/components/navigation/SiteChrome";
import { SectionRule } from "@/components/ui/SectionRule";
import { shareMetadata } from "@/lib/site";
import type { Metadata } from "next";
import Link from "next/link";
import { ReviewDeck } from "./ReviewDeck";

const description =
  "Re-ask every prediction checkpoint in the track: the ones you got wrong first, the ones you haven't reached yet, then the ones you called. Practice only — nothing here is recorded.";

export const metadata: Metadata = {
  title: "Review deck",
  description,
  ...shareMetadata({
    title: "Review deck",
    description,
    path: "/review",
  }),
};

/**
 * `/review` — the practice deck.
 *
 * Deliberately OUTSIDE the `/learn` layout: it is a track-wide surface, not a
 * lesson, and the sidebar's module tree would be the wrong "where am I". It
 * borrows `/about`'s standalone chrome instead — a small header that gets you
 * back — and keeps `main#main` so the root layout's skip link lands somewhere.
 *
 * Server component so the route ships real `<head>` metadata; every progress
 * read lives under `<ReviewDeck>`'s client boundary.
 */
export default function ReviewPage() {
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

      <main id="main" className="mx-auto max-w-3xl px-6 pb-20">
        <div className="mb-8">
          <SectionRule className="mb-4">
            <span className="tech-label text-accent">review</span>
          </SectionRule>
          <h1 className="font-display mb-3 text-3xl font-bold tracking-tight">
            Every prediction, in one deck
          </h1>
          <p className="max-w-xl leading-relaxed text-fg-muted">
            The simulations ask you to predict what a system will do before it
            does it. This is every one of those checkpoints, collected — worst
            first, so the ones that caught you out are the ones you practise.
            Each card links back to the exact sim-second the question is about.
          </p>
        </div>

        <ReviewDeck />
      </main>
    </div>
  );
}
