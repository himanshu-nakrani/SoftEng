import { LessonMap, TrackProgress } from "@/components/navigation/LessonMap";
import { track } from "@/lib/curriculum";
import { ArrowRight, ListChecks } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Learning path",
};

export default function LearnPage() {
  return (
    <>
      <header className="mb-10">
        <div className="mb-4 flex items-center gap-3">
          <span className="tech-label text-accent">track 01</span>
          <div className="tech-rule flex-1" />
        </div>
        <h1 className="font-display mb-3 text-3xl font-bold tracking-tight">
          {track.title}
        </h1>
        <p className="max-w-xl leading-relaxed text-fg-muted">
          {track.description}
        </p>
      </header>
      <TrackProgress />
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
      <LessonMap />
    </>
  );
}
