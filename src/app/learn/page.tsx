import { LessonMap, TrackProgress } from "@/components/navigation/LessonMap";
import { track } from "@/lib/curriculum";
import type { Metadata } from "next";

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
      <LessonMap />
    </>
  );
}
