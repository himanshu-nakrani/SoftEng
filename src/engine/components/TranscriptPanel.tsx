"use client";

import { cn } from "@/lib/cn";
import { useEffect, useRef } from "react";
import { CAPTION_DURATION } from "../runner";
import type { CaptionEntry } from "../useSimulation";

/**
 * How close to the bottom still counts as "pinned", in px. One row's height —
 * anything less and the auto-scroll gives up after a stray wheel notch, while
 * fractional `scrollHeight` on zoomed/HiDPI displays means exact equality is
 * never reached.
 */
const PIN_SLACK = 24;

interface TranscriptPanelProps {
  /** `Simulation.captionLog` — mutated in place, identity is NOT a signal. */
  log: readonly CaptionEntry[];
  /** `Simulation.captionLogVersion` — the actual change signal. */
  version: number;
  /** Snapshot clock, for deciding which line is the one on screen now. */
  t: number;
  /** Playback multiplier: caption windows are scaled by it (setCaptionScale). */
  speed: number;
  open: boolean;
  /** DOM id the toggle points `aria-controls` at. */
  id: string;
  /** `controls.seekTo` — a row IS a seek. */
  onSeek: (at: number) => void;
  /** A fired checkpoint owns the transport, so rows cannot seek out of it. */
  disabled?: boolean;
}

/**
 * Which line is the one currently on the stage.
 *
 * The runner shows the most recently fired caption until its window elapses,
 * so: the last line at or before `t`, and only if it is still inside that
 * window. The window is `CAPTION_DURATION` scaled by playback speed, which is
 * exactly what `SimRunner.setCaptionScale` does with it — so the highlight
 * tracks the caption card instead of drifting from it at 0.5x/2x.
 *
 * Lines rebuilt after a seek are stamped with the beat's scripted `at` rather
 * than the tick that raised it, so this can be up to one tick (33ms of sim
 * time) pessimistic. Invisible at a 4-second window.
 */
function currentIndex(log: readonly CaptionEntry[], t: number, speed: number) {
  const window = CAPTION_DURATION * (speed > 0 ? speed : 1);
  let last = -1;
  for (let i = 0; i < log.length; i++) {
    if (log[i].at <= t) last = i;
  }
  if (last === -1) return -1;
  return t - log[last].at <= window ? last : -1;
}

/**
 * The run's narration, kept.
 *
 * Captions are ephemeral by design — four sim-seconds on the stage and gone —
 * which makes the lesson's own story the one thing a learner cannot go back to.
 * This is that history, and because every line carries the sim-time it fired
 * at, it is also a table of contents: each row is a button that scrubs the run
 * to the moment it narrates.
 *
 * NO LIVE REGION, deliberately. `CaptionOverlay` is the announcer — its
 * `role="status"` reads each caption as it appears — and a second region
 * echoing the same text would double every announcement. This is a plain list
 * of buttons: navigation, not narration.
 */
export function TranscriptPanel({
  log,
  version,
  t,
  speed,
  open,
  id,
  onSeek,
  disabled,
}: TranscriptPanelProps) {
  const listRef = useRef<HTMLOListElement>(null);
  // Auto-scroll only while the learner is actually at the bottom. Reading an
  // older line and having it yanked away by the next beat is the failure mode
  // every log panel has; one boolean fixes it.
  const pinned = useRef(true);

  useEffect(() => {
    const el = listRef.current;
    if (!el || !pinned.current) return;
    el.scrollTop = el.scrollHeight;
    // `version` is the append signal (the array's identity never changes);
    // `open` re-pins the freshly mounted list.
  }, [version, open]);

  // Closed, or closed-and-empty: no element, no strip, no border. The toggle
  // carries `aria-expanded="false"` while this is absent, which is the shape
  // ARIA (and axe) expect for a collapsed disclosure.
  if (!open) return null;

  const current = currentIndex(log, t, speed);

  return (
    <div id={id} className="border-t border-border bg-bg/30">
      <ol
        ref={listRef}
        aria-label="Caption transcript"
        onScroll={() => {
          const el = listRef.current;
          if (!el) return;
          pinned.current =
            el.scrollHeight - el.scrollTop - el.clientHeight < PIN_SLACK;
        }}
        // ~6 rows before it scrolls; the seventh peeking is the affordance.
        className="max-h-40 overflow-y-auto overscroll-contain py-1"
      >
        {log.length === 0 && (
          <li className="tech-label px-3 py-1.5 text-fg-faint">
            no captions yet — press play
          </li>
        )}
        {log.map((entry, i) => {
          const isCurrent = i === current;
          return (
            <li key={`${i}-${entry.at}`}>
              <button
                type="button"
                onClick={() => onSeek(entry.at)}
                disabled={disabled}
                title={`Scrub to t=${entry.at.toFixed(1)}s`}
                aria-current={isCurrent ? "true" : undefined}
                className={cn(
                  "flex min-h-8 w-full cursor-pointer items-baseline gap-2.5 px-3 py-1 text-left transition-colors hover:bg-raised disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent",
                  isCurrent && "bg-accent-dim",
                )}
              >
                <span
                  className={cn(
                    "tech-num shrink-0 text-[10px]",
                    isCurrent ? "text-accent" : "text-fg-faint",
                  )}
                >
                  t={entry.at.toFixed(1)}s
                </span>
                <span
                  className={cn(
                    "font-mono text-xs leading-snug",
                    isCurrent ? "text-fg" : "text-fg-muted",
                  )}
                >
                  {entry.text}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
