"use client";

import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { cn } from "@/lib/cn";
import { Pause, Play, RotateCcw, StepForward } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SimControls, SimStatus } from "../useSimulation";

const SPEED_OPTIONS = [0.5, 1, 2].map((s) => ({
  value: s,
  label: `${s}x`,
  ariaLabel: `Speed ${s}x`,
}));

/** Scrub resolution, in sim-seconds. Also the keyboard arrow increment. */
const SCRUB_STEP = 0.1;

/**
 * Shortest track the scrubber ever draws, in sim-seconds. A fresh figure has
 * reached t=0 and a sim may script nothing at all; without a floor the range
 * input would be given max=0 (an inert control that looks broken).
 */
const MIN_SCRUB_SPAN = 10;

/** Sim-seconds of runway drawn past the last scripted beat. */
const SCRUB_TAIL = 2;

/** At most ~10 replays a second while dragging; the release always lands. */
const SEEK_INTERVAL_MS = 100;

/**
 * A scripted beat, structurally. `TimelineEvent<L>` and `QuizCheckpoint<L>` are
 * *contravariant* in `L` (their `when`/`apply` take the lesson's state), so no
 * concrete lesson's array is assignable to a `<unknown>`-parameterised one.
 * These read-only views name only the fields the track draws, which every
 * instantiation satisfies — so `<TransportBar timeline={sim.timeline}>` type-
 * checks for any lesson without the caller widening anything.
 */
export interface ScrubEvent {
  at: number;
  caption?: string;
  when?: unknown;
}

export interface ScrubCheckpoint {
  id: string;
  at: number;
  question?: string;
  when?: unknown;
}

interface ScrubMarker {
  key: string;
  at: number;
  kind: "event" | "checkpoint";
  title: string;
}

interface TransportBarProps {
  status: SimStatus;
  speed: number;
  t: number;
  controls: SimControls;
  /**
   * `Simulation.furthestT` — how far this run has actually got, which is where
   * the track ends once the scripted beats are behind us. Optional: without it
   * the track falls back to the current time (rounded up so the end stops
   * creeping every frame), which scrubs correctly but shrinks its own range
   * after a rewind.
   */
  furthestT?: number;
  /** `sim.timeline` — drawn as dots on the track. */
  timeline?: readonly ScrubEvent[];
  /** `sim.quiz` — drawn as violet diamonds. */
  quiz?: readonly ScrubCheckpoint[];
}

/**
 * A beat earns a marker when its `at` is a real position on the clock.
 *
 * Gated beats are the wrinkle. Lessons use two shapes: a gate on top of a real
 * time ("at 21, if VNODES is still off"), where `at` is a meaningful earliest
 * moment worth marking; and `at: 0` as a pure sentinel — "whenever the learner
 * gets there, however long that takes" (cache-stampede's dogpile beat,
 * consistent-hashing's kill beat). A dot pinned to the track's left edge would
 * claim those happen at t=0, which is the one thing they do not do — so a
 * gated beat at `at <= 0` is skipped. Ungated beats are always placed: they
 * fire on the clock, `at: 0` included.
 */
const isPlaced = (beat: { at: number; when?: unknown }) =>
  Number.isFinite(beat.at) && (beat.when === undefined || beat.at > 0);

function buildMarkers(
  timeline: readonly ScrubEvent[] | undefined,
  quiz: readonly ScrubCheckpoint[] | undefined,
): ScrubMarker[] {
  const markers: ScrubMarker[] = [];
  timeline?.forEach((ev, i) => {
    if (!isPlaced(ev)) return;
    markers.push({
      key: `ev-${i}`,
      at: ev.at,
      kind: "event",
      title: ev.caption ?? "Scripted beat",
    });
  });
  quiz?.forEach((q) => {
    if (!isPlaced(q)) return;
    markers.push({
      key: `quiz-${q.id}`,
      at: q.at,
      kind: "checkpoint",
      title: q.question ? `Checkpoint — ${q.question}` : "Checkpoint",
    });
  });
  return markers;
}

/**
 * Rate-limit seeking without losing the value the learner released on.
 *
 * Every drag pixel fires a `change`, and every seek replays the run from the
 * seed — cheap (single-digit ms) but not sixty-times-a-second cheap. Leading
 * edge fires immediately so a click feels instant; anything inside the window
 * is coalesced into one trailing call, and `flush` (pointer up, key up) runs
 * the pending value at once so the sim always ends where the handle did.
 */
function useThrottledSeek(seek: (t: number) => void) {
  const lastAt = useRef(0);
  const pending = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  // `seek` is `controls.seekTo`, which the hook memoizes for the life of the
  // sim — so depending on it directly keeps these callbacks stable without
  // mirroring it into a ref (a ref write during render is exactly what the
  // react-hooks lint forbids outside the engine's three render-loop files).
  const run = useCallback(
    (t: number) => {
      lastAt.current = Date.now();
      pending.current = null;
      seek(t);
    },
    [seek],
  );

  const flush = useCallback(() => {
    const value = pending.current;
    clearTimer();
    if (value !== null) run(value);
  }, [clearTimer, run]);

  const request = useCallback(
    (t: number) => {
      const wait = SEEK_INTERVAL_MS - (Date.now() - lastAt.current);
      if (wait <= 0) {
        clearTimer();
        run(t);
        return;
      }
      pending.current = t;
      if (timer.current === null) {
        timer.current = setTimeout(() => {
          timer.current = null;
          flush();
        }, wait);
      }
    },
    [clearTimer, flush, run],
  );

  useEffect(() => clearTimer, [clearTimer]);

  return { request, flush };
}

/**
 * Play / pause / step / speed / restart, the scrub track, and the sim clock.
 *
 * `aria-keyshortcuts` advertises the figure-level keyboard shortcuts (Space,
 * `.`, R). This component deliberately binds no handlers for those: the
 * listener belongs on the figure container (so a shortcut works anywhere in the
 * figure, not only while a transport button holds focus) and is wired
 * separately. The attributes name the contract both halves implement.
 *
 * The scrub track is the exception, and it needs no coordination: the figure's
 * key handler ignores events whose target is an `input`, so the range's native
 * Arrow/Home/End behaviour is ours alone — each keystroke moves `value` by
 * `SCRUB_STEP` and seeks there.
 */
export function TransportBar({
  status,
  speed,
  t,
  controls,
  furthestT,
  timeline,
  quiz,
}: TransportBarProps) {
  const playing = status === "playing";
  const quizzing = status === "quiz";

  const markers = useMemo(() => buildMarkers(timeline, quiz), [timeline, quiz]);

  // The track spans everything worth reaching: what has been seen, plus a
  // little runway past the last scripted beat so the scrub is useful before
  // the run gets there (seeking forward is a fast-forward, not an error).
  const scrubMax = useMemo(() => {
    const lastBeat = markers.reduce((max, m) => Math.max(max, m.at), 0);
    const seen = furthestT ?? Math.ceil(t);
    return (
      Math.round(
        Math.max(seen, lastBeat + SCRUB_TAIL, MIN_SCRUB_SPAN) * 10,
      ) / 10
    );
  }, [furthestT, markers, t]);

  const { request, flush } = useThrottledSeek(controls.seekTo);

  // While the handle is held, the input follows the pointer rather than the
  // (throttled, ~10Hz) snapshot — otherwise the thumb visibly lags the drag.
  // Released, it goes back to reporting sim time, which is the truth.
  const [scrubbing, setScrubbing] = useState<number | null>(null);
  // Snapped to the step (and kept float-dust free) so the DOM attribute is
  // "12.4", not "12.400000000000002".
  const value = scrubbing ?? Math.round(Math.min(Math.max(t, 0), scrubMax) * 10) / 10;

  const release = () => {
    flush();
    setScrubbing(null);
  };

  return (
    <div className="flex flex-wrap items-center gap-1 border-t border-border px-3 py-2">
      <button
        type="button"
        onClick={controls.toggle}
        disabled={quizzing}
        aria-label={playing ? "Pause simulation" : "Play simulation"}
        aria-keyshortcuts="Space"
        className="flex size-8 cursor-pointer items-center justify-center rounded-lg bg-accent text-bg transition-all hover:brightness-110 disabled:opacity-40"
      >
        {playing ? (
          <Pause className="size-4" fill="currentColor" strokeWidth={0} />
        ) : (
          <Play className="size-4 translate-x-px" fill="currentColor" strokeWidth={0} />
        )}
      </button>

      <button
        type="button"
        onClick={controls.stepOnce}
        disabled={playing || quizzing}
        aria-label="Advance one tick"
        aria-keyshortcuts="."
        title="Step one tick"
        className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-raised hover:text-fg disabled:pointer-events-none disabled:opacity-40"
      >
        <StepForward className="size-4" />
      </button>

      <button
        type="button"
        onClick={controls.restart}
        aria-label="Restart simulation"
        aria-keyshortcuts="R"
        title="Restart (deterministic replay)"
        className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-raised hover:text-fg"
      >
        <RotateCcw className="size-4" />
      </button>

      <div className="mx-2 h-4 w-px bg-border" />

      <SegmentedControl
        ariaLabel="Playback speed"
        size="sm"
        options={SPEED_OPTIONS}
        value={speed}
        onChange={controls.setSpeed}
      />

      {/* The scrub track. Inline between the speed switch and the clock where
          there is width for it; on narrow screens `order-last w-full` wraps it
          onto its own line rather than crushing it to a stub. The row is sized
          (h-10 there, the bar's own 48px here) so the slider's 44px hit box —
          `.sim-slider`'s padding, which bleeds past the 4px track — clears the
          buttons instead of stealing their taps. */}
      <div className="relative order-last flex h-10 w-full items-center sm:order-none sm:mx-3 sm:h-auto sm:w-auto sm:min-w-24 sm:flex-1">
        <input
          type="range"
          min={0}
          max={scrubMax}
          step={SCRUB_STEP}
          value={value}
          disabled={quizzing}
          onChange={(e) => {
            const next = Number(e.target.value);
            setScrubbing(next);
            request(next);
          }}
          onPointerUp={release}
          onKeyUp={release}
          onBlur={release}
          aria-label="Timeline"
          aria-valuetext={`t = ${value.toFixed(1)}s`}
          title="Scrub the timeline — replays from the seed"
          className="sim-slider h-1 w-full cursor-pointer appearance-none rounded-full bg-border accent-accent disabled:cursor-not-allowed disabled:opacity-40"
          // Drives the filled-track gradient in globals.css.
          style={
            {
              "--fill": `${(value / scrubMax) * 100}%`,
            } as React.CSSProperties
          }
        />
        {/* Scripted beats: dots for timeline captions, violet diamonds for
            checkpoints (the same violet the quiz status pip uses). Inset by
            half a thumb width so a marker sits under the thumb's centre when
            the sim is at that moment.

            Inert on purpose — the track must own every pointer event, so a
            press next to a marker seeks instead of being swallowed by it. That
            does cost the native tooltip (`pointer-events: none` means no
            hover), so `title` here is descriptive metadata for the DOM, not a
            hover affordance; the caption itself still plays over the stage
            when the beat fires. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-2 top-1/2 h-0"
        >
          {markers.map((m) => (
            <span
              key={m.key}
              title={m.title}
              style={{ left: `${(m.at / scrubMax) * 100}%` }}
              className={cn(
                "absolute -translate-x-1/2 -translate-y-1/2 ring-1 ring-bg",
                m.kind === "checkpoint"
                  ? "size-1.5 rotate-45 bg-glow-violet"
                  : "size-1 rounded-full bg-fg-muted",
              )}
            />
          ))}
        </div>
      </div>

      <span className="tech-num ml-auto flex items-center gap-2 text-xs text-fg-muted">
        <span
          className={cn(
            "size-1.5 rounded-full",
            playing
              ? "animate-pulse bg-glow-green shadow-[0_0_6px_var(--color-glow-green)]"
              : quizzing
                ? "bg-glow-violet"
                : "bg-glow-orange",
          )}
        />
        t={t.toFixed(1)}s
      </span>
    </div>
  );
}
