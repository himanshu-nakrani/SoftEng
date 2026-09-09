import { LessonMap, TrackProgress } from "@/components/navigation/LessonMap";
import { SectionRule } from "@/components/ui/SectionRule";
import { getTrack, trackLabel } from "@/lib/curriculum";
import { shareMetadata } from "@/lib/site";
import { ArrowRight, ListChecks } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

/**
 * One track's landing page: the header plate, the section-weighted progress
 * readout, and the lesson map.
 *
 * Shared rather than copied because every track's page is otherwise identical
 * — a track route is three lines (`<TrackLanding trackSlug="…" />`), which is
 * what keeps eleven tracks from becoming eleven divergent layouts.
 */
export function TrackLanding({ trackSlug }: { trackSlug: string }) {
  const track = getTrack(trackSlug);
  // A track page whose slug the registry doesn't know is a build-time bug, but
  // 404 rather than crash: the route folder is hand-written, the registry is
  // the truth, and `check-curriculum` fails the build on the mismatch anyway.
  if (!track) notFound();

  return (
    <>
      <header className="mb-10">
        <SectionRule className="mb-4">
          <span className="tech-label text-accent">{trackLabel(track)}</span>
        </SectionRule>
        <h1 className="font-display mb-3 text-3xl font-bold tracking-tight">
          {track.title}
        </h1>
        <p className="max-w-xl leading-relaxed text-fg-muted">
          {track.description}
        </p>
      </header>

      <TrackProgress trackSlug={track.slug} />

      {/* Hangs off the bottom edge of the progress strip (which owns the mb-10)
          — the deck is a readout of the same record the card above summarises. */}
      <div className="-mt-8 mb-10 flex justify-end">
        <Link
          href="/review"
          className="group inline-flex items-center gap-2 text-[13px] text-fg-muted transition-colors hover:text-fg"
        >
          <ListChecks className="size-4 text-accent" strokeWidth={1.75} />
          Practise every prediction checkpoint
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      <LessonMap trackSlug={track.slug} />
    </>
  );
}

/** `<head>` for a track route, derived from the registry like lesson pages. */
export function trackMetadata(trackSlug: string): Metadata {
  const track = getTrack(trackSlug);
  if (!track) return {};

  return {
    title: track.title,
    description: track.description,
    ...shareMetadata({
      title: track.title,
      description: track.description,
      path: `/learn/${track.slug}`,
    }),
  };
}
