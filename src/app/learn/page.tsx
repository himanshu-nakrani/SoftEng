import { CurriculumIndex } from "@/components/navigation/CurriculumIndex";
import { ProgressSettings } from "@/components/navigation/ProgressSettings";
import { SectionRule } from "@/components/ui/SectionRule";
import { allLessons, modules, tracks } from "@/lib/curriculum";
import { ArrowRight, ListChecks } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Curriculum",
  description:
    "Every track: what it covers, how many lessons are live, and how far through it you are.",
};

/**
 * The curriculum index — one level above the tracks.
 *
 * Counts here are deliberately cross-track (this is the only page that should
 * total the whole site); everything a learner reads as "my progress" is scoped
 * per track by `CurriculumIndex`.
 */
export default function LearnPage() {
  const live = allLessons.filter((l) => l.status === "available").length;

  return (
    <>
      <header className="mb-10">
        <SectionRule className="mb-4">
          <span className="tech-label text-accent">curriculum</span>
          <span className="tech-num ml-auto text-xs text-fg-faint">
            {tracks.length} track{tracks.length === 1 ? "" : "s"} ·{" "}
            {modules.length} modules · {live} lessons
          </span>
        </SectionRule>
        <h1 className="font-display mb-3 text-3xl font-bold tracking-tight">
          Learn systems by breaking them
        </h1>
        <p className="max-w-xl leading-relaxed text-fg-muted">
          Every lesson is a running simulation you can drive, break, and
          replay. Pick a track and start anywhere — nothing is locked.
        </p>
      </header>

      <CurriculumIndex />

      <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5">
        <Link
          href="/review"
          className="group inline-flex items-center gap-2 text-[13px] text-fg-muted transition-colors hover:text-fg"
        >
          <ListChecks className="size-4 text-accent" strokeWidth={1.75} />
          Practise every prediction checkpoint
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
        <ProgressSettings />
      </div>
    </>
  );
}
