"use client";

import type { LessonMeta } from "@/curriculum/types";
import { useHydrated } from "@/hooks/use-hydrated";
import { cn } from "@/lib/cn";
import { JOURNAL_NOTE_LIMIT, type Confidence, useJournal } from "@/stores/journal";
import { Check, LockKeyhole, NotebookPen, Save } from "lucide-react";
import { useState } from "react";

const confidenceOptions: Array<{
  value: Confidence;
  label: string;
  description: string;
}> = [
  { value: "uncertain", label: "Uncertain", description: "I need another pass." },
  { value: "getting-it", label: "Getting it", description: "I can follow the path." },
  { value: "can-explain", label: "Can explain it", description: "I can teach the trade-off." },
];

export function ReflectionCard({ meta }: { meta: LessonMeta }) {
  const hydrated = useHydrated();
  const entry = useJournal((state) => state.entries[meta.slug]);
  const setEntry = useJournal((state) => state.setEntry);
  const note = entry?.note ?? "";
  const confidence = entry?.confidence ?? "uncertain";
  const [notice, setNotice] = useState("");

  function save() {
    setNotice("Saved locally on this device.");
    window.setTimeout(() => setNotice(""), 2400);
  }

  return (
    <section
      className="surface-card mb-12 overflow-hidden border-accent/25"
      aria-labelledby={`${meta.slug}-reflection`}
    >
      <div className="border-b border-border bg-raised/35 px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="tech-label inline-flex items-center gap-1.5 text-accent">
            <NotebookPen className="size-3.5" strokeWidth={1.75} />
            learning journal
          </span>
          <span className="text-fg-faint">/</span>
          <span className="font-mono text-[10px] tracking-widest text-fg-faint uppercase">
            private by default
          </span>
        </div>
        <h2 id={`${meta.slug}-reflection`} className="mt-2 font-display text-xl font-semibold tracking-tight">
          What will you remember from this run?
        </h2>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-fg-muted">
          Write one sentence in your own words. A short explanation is more useful
          here than a perfect transcript.
        </p>
      </div>

      <div className="grid gap-5 px-5 py-5 sm:px-6 lg:grid-cols-[1fr_auto]">
        <div>
          <label htmlFor={`${meta.slug}-reflection-note`} className="tech-label mb-2 block text-fg-muted">
            your reflection
          </label>
          <textarea
            id={`${meta.slug}-reflection-note`}
            value={note}
            maxLength={JOURNAL_NOTE_LIMIT}
            onChange={(event) => setEntry(meta.slug, { note: event.target.value })}
            placeholder="When capacity is concentrated, one failure can remove everything…"
            className="min-h-24 w-full resize-y rounded-lg border border-border bg-bg/35 px-3.5 py-3 text-sm leading-relaxed text-fg outline-none transition-colors placeholder:text-fg-faint focus:border-accent focus:ring-2 focus:ring-accent/25"
            aria-describedby={`${meta.slug}-reflection-help`}
          />
          <div className="mt-1 flex items-center justify-between gap-3">
            <p id={`${meta.slug}-reflection-help`} className="text-xs text-fg-faint">
              Stored only in this browser. You can export it from the Review deck.
            </p>
            <span className="shrink-0 font-mono text-[10px] text-fg-faint">
              {note.length}/{JOURNAL_NOTE_LIMIT}
            </span>
          </div>
        </div>

        <fieldset className="min-w-52">
          <legend className="tech-label mb-2 text-fg-muted">confidence</legend>
          <div className="flex flex-col gap-1.5" role="radiogroup" aria-label="Confidence in this lesson">
            {confidenceOptions.map((option) => {
              const selected = confidence === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setEntry(meta.slug, { confidence: option.value })}
                  className={cn(
                    "flex min-h-11 items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors",
                    selected
                      ? "border-accent/70 bg-accent/10 text-fg"
                      : "border-border bg-raised/35 text-fg-muted hover:border-border-bright hover:text-fg",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "flex size-4 shrink-0 items-center justify-center rounded-full border",
                      selected ? "border-accent bg-accent text-accent-ink" : "border-border-bright",
                    )}
                  >
                    {selected && <Check className="size-3" strokeWidth={2.5} />}
                  </span>
                  <span>
                    <span className="block text-xs font-medium">{option.label}</span>
                    <span className="block text-[11px] text-fg-faint">{option.description}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-raised/20 px-5 py-3 sm:px-6">
        <p className="inline-flex items-center gap-1.5 text-xs text-fg-faint">
          <LockKeyhole className="size-3.5" strokeWidth={1.75} />
          No account. No server. Your note stays local.
        </p>
        <div className="flex items-center gap-3">
          <span role="status" className="text-xs text-glow-green" aria-live="polite">
            {notice}
          </span>
          <button
            type="button"
            onClick={save}
            disabled={!hydrated}
            className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-accent px-3.5 py-2 text-xs font-semibold text-accent-ink transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save className="size-3.5" strokeWidth={1.75} />
            Save reflection
          </button>
        </div>
      </div>
    </section>
  );
}
