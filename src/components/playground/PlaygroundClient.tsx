"use client";

import { InteractiveFigure } from "@/engine/components/InteractiveFigure";
import type { LessonSim } from "@/engine/types";
import { simBySlug } from "@/lessons/index";
import { cn } from "@/lib/cn";
import { allLessons, getLesson, moduleOf } from "@/lib/curriculum";
import type { Accent } from "@/curriculum/types";
import { Check, Dices, Share2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

const accentVar: Record<Accent, string> = {
  cyan: "var(--color-glow-cyan)",
  violet: "var(--color-glow-violet)",
  amber: "var(--color-accent)",
  green: "var(--color-glow-green)",
  red: "var(--color-glow-red)",
};

interface PlaygroundEntry {
  slug: string;
  title: string;
  accent: Accent;
  sim: LessonSim<unknown>;
}

/** Every registered sim, titled from the curriculum registry. */
const playgroundSims: PlaygroundEntry[] = allLessons
  .filter((l) => l.status === "available" && simBySlug[l.slug])
  .map((l) => ({
    slug: l.slug,
    title: l.title,
    accent: moduleOf(l).accent,
    sim: simBySlug[l.slug]!,
  }));

/** Strip the script: free play means no timeline, no quizzes. */
function sandbox(sim: LessonSim<unknown>): LessonSim<unknown> {
  return { ...sim, timeline: [], quiz: [] };
}

export function PlaygroundClient() {
  const search = useSearchParams();

  const urlSlug = search.get("sim");
  const initialEntry =
    playgroundSims.find((e) => e.slug === urlSlug) ?? playgroundSims[0];
  const [slug, setSlug] = useState(initialEntry?.slug ?? "");
  const [seed, setSeed] = useState(() => {
    const s = Number(search.get("seed"));
    return Number.isFinite(s) && s > 0 ? Math.floor(s) : 42;
  });
  const [copied, setCopied] = useState(false);

  const entry = playgroundSims.find((e) => e.slug === slug) ?? playgroundSims[0];
  const sim = useMemo(
    () => (entry ? sandbox(entry.sim) : null),
    [entry],
  );

  const share = async () => {
    if (!entry) return;
    const q = new URLSearchParams({ sim: slug, seed: String(seed) });
    const url = `${location.origin}${location.pathname}?${q}`;
    window.history.replaceState(null, "", `?${q}`);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — URL bar already holds the link */
    }
  };

  const reseed = () => {
    const next = Math.floor(Math.random() * 90000) + 1;
    setSeed(next);
    window.history.replaceState(null, "", `?sim=${slug}&seed=${next}`);
  };

  const pick = (nextSlug: string) => {
    setSlug(nextSlug);
    window.history.replaceState(null, "", `?sim=${nextSlug}&seed=${seed}`);
  };

  if (!entry || !sim) {
    return (
      <p className="text-fg-muted">No simulations registered yet.</p>
    );
  }

  // Keep title/accent in sync if the registry has the lesson.
  const lesson = getLesson(entry.slug);
  const title = lesson?.title ?? entry.title;
  const accent = lesson ? moduleOf(lesson).accent : entry.accent;

  return (
    <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
      <nav aria-label="Simulations" className="lg:sticky lg:top-8 lg:self-start">
        <p className="tech-label mb-3">simulations</p>
        <ul className="flex flex-wrap gap-1 lg:flex-col">
          {playgroundSims.map((e) => (
            <li key={e.slug}>
              <button
                type="button"
                onClick={() => pick(e.slug)}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-left font-mono text-xs transition-colors",
                  e.slug === slug
                    ? "bg-raised text-fg"
                    : "text-fg-muted hover:bg-surface hover:text-fg",
                )}
              >
                <span
                  className="size-1.5 shrink-0 rounded-full"
                  style={{ background: accentVar[e.accent] }}
                />
                {e.title}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="min-w-0">
        <div className="mb-2 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-xl font-bold tracking-tight">
            {title}
          </h1>
          <span className="tech-label">sandbox — no script, no quizzes</span>
          <span
            className="size-1.5 rounded-full"
            style={{ background: accentVar[accent] }}
            aria-hidden
          />
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={reseed}
              title="New random seed (deterministic per seed)"
              className="flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 font-mono text-[11px] text-fg-muted transition-colors hover:border-border-bright hover:text-fg"
            >
              <Dices className="size-3.5" />
              seed {seed}
            </button>
            <button
              type="button"
              onClick={share}
              title="Copy a link that reproduces this exact run"
              className="flex cursor-pointer items-center gap-1.5 rounded-md bg-accent px-2.5 py-1.5 font-mono text-[11px] font-medium text-bg transition-all hover:brightness-110"
            >
              {copied ? (
                <Check className="size-3.5" />
              ) : (
                <Share2 className="size-3.5" />
              )}
              {copied ? "copied" : "share run"}
            </button>
          </div>
        </div>

        <InteractiveFigure
          key={`${slug}:${seed}`}
          sim={sim}
          seed={seed}
          description={`Sandbox: the ${title} simulation with all parameters unlocked and no scripted events.`}
        />

        <p className="mt-3 font-mono text-[11px] leading-relaxed text-fg-faint">
          same seed ⇒ identical run. hit{" "}
          <span className="text-fg-muted">share run</span> to copy a link for
          this sim + seed.
        </p>
      </div>
    </div>
  );
}
