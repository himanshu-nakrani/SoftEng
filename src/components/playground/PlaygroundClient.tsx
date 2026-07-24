"use client";

import { InteractiveFigure } from "@/engine/components/InteractiveFigure";
import type { ParamValues } from "@/engine/types";
import { playgroundSims, type AnyLessonSim } from "@/lessons/index";
import { cn } from "@/lib/cn";
import { decodeParams, encodeShare } from "@/lib/share";
import type { Accent } from "@/curriculum/types";
import { Check, Dices, Share2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useMemo, useRef, useState } from "react";

const accentVar: Record<Accent, string> = {
  cyan: "var(--color-glow-cyan)",
  violet: "var(--color-glow-violet)",
  amber: "var(--color-accent)",
  green: "var(--color-glow-green)",
  red: "var(--color-glow-red)",
};

/** Strip the script: free play means no timeline, no quizzes. */
function sandbox(sim: AnyLessonSim): AnyLessonSim {
  return { ...sim, timeline: [], quiz: [] };
}

export function PlaygroundClient() {
  const search = useSearchParams();

  // Initial state from the URL (share links); defaults otherwise.
  const urlSlug = search.get("sim");
  const initialEntry =
    playgroundSims.find((e) => e.slug === urlSlug) ?? playgroundSims[0];
  const [slug, setSlug] = useState(initialEntry.slug);
  const [seed, setSeed] = useState(() => {
    const s = Number(search.get("seed"));
    return Number.isFinite(s) && s > 0 ? Math.floor(s) : 42;
  });
  const [copied, setCopied] = useState(false);

  const entry = playgroundSims.find((e) => e.slug === slug)!;
  const sim = useMemo(() => sandbox(entry.sim), [entry.sim]);

  // Only apply URL params to the sim the link was for.
  const initialParams = useMemo(
    () =>
      entry.slug === urlSlug ? decodeParams(search, entry.sim.params) : {},
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entry.slug],
  );

  // Track live params for share links without re-rendering per change.
  const liveParams = useRef<ParamValues>({});

  const syncUrl = (params: ParamValues) => {
    const q = encodeShare({ sim: slug, seed, params });
    window.history.replaceState(null, "", `?${q}`);
  };

  const share = async () => {
    const q = encodeShare({ sim: slug, seed, params: liveParams.current });
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
    liveParams.current = {};
    window.history.replaceState(null, "", `?sim=${nextSlug}&seed=${seed}`);
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
      {/* picker */}
      <nav aria-label="Simulations" className="lg:sticky lg:top-8 lg:self-start">
        <p className="tech-label mb-3">simulations</p>
        <ul className="flex flex-wrap gap-1 lg:flex-col">
          {playgroundSims.map((e) => (
            <li key={e.slug}>
              <button
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

      {/* stage */}
      <div className="min-w-0">
        <div className="mb-2 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-xl font-bold tracking-tight">
            {entry.title}
          </h1>
          <span className="tech-label">sandbox — no script, no quizzes</span>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={reseed}
              title="New random seed (deterministic per seed)"
              className="flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 font-mono text-[11px] text-fg-muted transition-colors hover:border-border-bright hover:text-fg"
            >
              <Dices className="size-3.5" />
              seed {seed}
            </button>
            <button
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
          initialParams={initialParams}
          onParamsChange={(params) => {
            liveParams.current = params;
            syncUrl(params);
          }}
          description={`Sandbox: the ${entry.title} simulation with all parameters unlocked and no scripted events.`}
        />

        <p className="mt-3 font-mono text-[11px] leading-relaxed text-fg-faint">
          same seed + same params ⇒ identical run. move a slider, hit{" "}
          <span className="text-fg-muted">share run</span>, and the link
          reproduces exactly what you&apos;re seeing.
        </p>
      </div>
    </div>
  );
}
