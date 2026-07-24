"use client";

import { GlowCard } from "@/components/ui/GlowCard";
import { lessonPath, nextLesson } from "@/lib/curriculum";
import { ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";
import { useLessonMeta } from "./context";

/** Bottom-of-lesson forward navigation. */
export function NextLessonCard() {
  const meta = useLessonMeta();
  const next = nextLesson(meta.slug);

  if (!next) {
    return (
      <GlowCard accent="green" active className="mt-16 px-5 py-4">
        <p className="tech-label mb-1 text-glow-green">track complete</p>
        <p className="font-display text-lg font-semibold">
          You&apos;ve reached the end — for now.
        </p>
      </GlowCard>
    );
  }

  if (next.status === "coming-soon") {
    return (
      <div className="mt-16 rounded-xl border border-border bg-surface px-5 py-4 opacity-60">
        <p className="tech-label mb-1 flex items-center gap-1.5">
          <Sparkles className="size-3" />
          next up — coming soon
        </p>
        <p className="font-display text-lg font-semibold">{next.title}</p>
      </div>
    );
  }

  return (
    <Link href={lessonPath(next)} className="group mt-16 block">
      <GlowCard className="flex items-center gap-4 px-5 py-4">
        <div>
          <p className="tech-label mb-1">next lesson</p>
          <p className="font-display text-lg font-semibold">{next.title}</p>
        </div>
        <ArrowRight className="ml-auto size-5 text-accent transition-transform group-hover:translate-x-1" />
      </GlowCard>
    </Link>
  );
}
