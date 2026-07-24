import { LessonMap } from "@/components/navigation/LessonMap";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Learning path",
};

export default function LearnPage() {
  return (
    <>
      <header className="mb-10">
        <h1 className="font-display mb-2 text-3xl font-bold tracking-tight">
          Learning path
        </h1>
        <p className="max-w-xl leading-relaxed text-fg-muted">
          Interactive tracks, learned in order or raided for the concept you
          need today. Progress lives in your browser.
        </p>
      </header>
      <LessonMap />
    </>
  );
}
