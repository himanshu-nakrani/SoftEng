"use client";

import { cn } from "@/lib/cn";
import { Check, X } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";

/* Live micro-widgets — each vignette demonstrates its verb by being it. */

function ObserveWidget() {
  return (
    <svg viewBox="0 0 220 48" className="h-10 w-full max-w-56" aria-hidden>
      <line
        x1={10}
        y1={24}
        x2={210}
        y2={24}
        stroke="var(--color-border-bright)"
        strokeWidth={1.25}
      />
      {[0, 1, 2].map((i) => (
        <circle
          key={i}
          r={4}
          cy={24}
          fill="var(--color-accent)"
          className="vignette-packet"
          style={{ animationDelay: `${i * 0.9}s` }}
        />
      ))}
    </svg>
  );
}

function ManipulateWidget() {
  const [value, setValue] = useState(35);
  const fraction = value / 100;
  return (
    <div className="flex w-full max-w-56 items-center gap-3">
      <svg viewBox="0 0 44 26" className="h-9 w-14 shrink-0" aria-hidden>
        <path
          d="M 4 24 A 18 18 0 0 1 40 24"
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={4}
          strokeLinecap="round"
        />
        <path
          d="M 4 24 A 18 18 0 0 1 40 24"
          fill="none"
          stroke={
            fraction > 0.8
              ? "var(--color-glow-red)"
              : "var(--color-accent)"
          }
          strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray={Math.PI * 18}
          strokeDashoffset={Math.PI * 18 * (1 - fraction)}
          style={{ transition: "stroke-dashoffset 120ms linear, stroke 300ms" }}
        />
      </svg>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
        aria-label="Demo load slider"
        className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-border accent-accent"
      />
      <span className="tech-num w-9 text-right text-xs text-fg-muted">
        {value}%
      </span>
    </div>
  );
}

/* ---- predict -------------------------------------------------------------
   A miniature of the product's prediction checkpoint: commit to an outcome,
   then watch it play out. Deterministic by construction (no engine, no RNG) —
   in 120/s against out 90/s can only end one way, which is the point.
--------------------------------------------------------------------------- */

type PredictChoice = "drains" | "explodes";

const PREDICT_CHOICES: { id: PredictChoice; label: string }[] = [
  { id: "drains", label: "queue drains" },
  { id: "explodes", label: "queue explodes" },
];

/** Arrivals outrun service, so the depth can only run away. */
const PREDICT_TRUTH: PredictChoice = "explodes";

/** How long the outcome takes to play out, then how long the stamp holds. */
const PLAY_MS = 1900;
const HOLD_MS = 2400;

const QUEUE_IDLE = 0.14;
const QUEUE_FULL = 0.98;

function PredictWidget() {
  const reduced = useReducedMotion();
  const [choice, setChoice] = useState<PredictChoice | null>(null);
  const [phase, setPhase] = useState<"idle" | "playing" | "verdict">("idle");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);
  useEffect(() => clearTimers, [clearTimers]);

  const pick = (next: PredictChoice) => {
    if (phase !== "idle") return;
    clearTimers();
    setChoice(next);
    const reset = () => {
      setPhase("idle");
      setChoice(null);
    };

    // Reduced motion: no play-out, just the answer.
    if (reduced) {
      setPhase("verdict");
      timers.current.push(setTimeout(reset, HOLD_MS));
      return;
    }
    setPhase("playing");
    timers.current.push(setTimeout(() => setPhase("verdict"), PLAY_MS));
    timers.current.push(setTimeout(reset, PLAY_MS + HOLD_MS));
  };

  const revealed = phase === "verdict";
  const correct = choice === PREDICT_TRUTH;
  const depth = phase === "idle" ? QUEUE_IDLE : QUEUE_FULL;
  const verdictColor = correct
    ? "var(--color-glow-green)"
    : "var(--color-glow-red)";

  return (
    <div className="flex w-full max-w-56 flex-col gap-2">
      <p className="font-mono text-[10px] tracking-wide text-fg-faint">
        in 120/s <span className="text-border-bright">·</span> out 90/s
      </p>

      <div className="flex gap-1.5">
        {PREDICT_CHOICES.map((option) => {
          const chosen = choice === option.id;
          return (
            <button
              key={option.id}
              onClick={() => pick(option.id)}
              disabled={phase !== "idle"}
              className={cn(
                "flex-1 cursor-pointer rounded border px-2 py-1.5 font-mono text-[10px] tracking-wide transition-all disabled:cursor-default",
                phase === "idle" &&
                  "border-border-bright bg-raised text-fg-muted hover:border-accent/60 hover:text-fg",
                phase === "playing" &&
                  (chosen
                    ? "border-accent/70 bg-accent-dim text-fg"
                    : "border-border text-fg-faint opacity-45"),
                revealed &&
                  chosen &&
                  correct &&
                  "border-glow-green/60 bg-glow-green-dim text-glow-green",
                revealed &&
                  chosen &&
                  !correct &&
                  "border-glow-red/60 bg-glow-red-dim text-glow-red",
                revealed && !chosen && "border-border text-fg-faint opacity-45",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {/* queue depth — the outcome, playing out in one CSS transition */}
      <div
        className="relative h-1.5 w-full overflow-hidden rounded-full bg-border"
        aria-hidden
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            width: `${depth * 100}%`,
            background:
              phase === "idle"
                ? "var(--color-accent)"
                : "var(--color-glow-orange)",
            transition:
              phase === "idle"
                ? "width 480ms var(--ease-out-soft), background 480ms linear"
                : `width ${PLAY_MS}ms linear, background ${PLAY_MS}ms linear`,
          }}
        />
        {/* capacity mark — past this the queue is shedding */}
        <span className="absolute inset-y-0 left-[76%] w-px bg-fg-faint/80" />
      </div>

      <p
        role="status"
        className="tech-label flex h-4 items-center gap-1"
        style={revealed ? { color: verdictColor } : undefined}
      >
        {revealed ? (
          <>
            {correct ? (
              <Check className="size-3 shrink-0" />
            ) : (
              <X className="size-3 shrink-0" />
            )}
            {correct ? "correct" : "not quite — watch again"}
          </>
        ) : phase === "playing" ? (
          "resolving…"
        ) : (
          "pick one — then watch"
        )}
      </p>
    </div>
  );
}

function BreakWidget() {
  const [dead, setDead] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const kill = () => {
    if (dead) return;
    setDead(true);
    timer.current = setTimeout(() => setDead(false), 2200);
  };

  return (
    <button
      onClick={kill}
      aria-label={dead ? "Server dead — self-healing" : "Kill this server"}
      className={cn(
        "flex cursor-pointer items-center gap-2.5 rounded-md border px-3.5 py-2 transition-all",
        dead
          ? "border-glow-red bg-glow-red-dim shadow-[0_0_20px_-6px_var(--color-glow-red)]"
          : "border-border-bright bg-raised hover:border-glow-red/60",
      )}
    >
      <span
        className={cn(
          "size-2 rounded-full transition-colors",
          dead
            ? "bg-glow-red"
            : "bg-glow-green shadow-[0_0_6px_var(--color-glow-green)]",
        )}
      />
      <span className="font-mono text-xs text-fg">
        {dead ? "api-1 · DEAD" : "api-1 · healthy"}
      </span>
      <span className="ml-1 font-mono text-[10px] text-fg-faint">
        {dead ? "healing…" : "click to kill"}
      </span>
    </button>
  );
}

const VERBS = [
  {
    n: "01",
    label: "observe",
    title: "Watch systems move",
    body: "Requests are dots you can see. Queues fill, caches evict, replicas lag — animated, narrated, at your pace.",
    widget: <ObserveWidget />,
  },
  {
    n: "02",
    label: "manipulate",
    title: "Turn the knobs",
    body: "Every parameter is a live slider. Push traffic past capacity and watch the failure arrive on schedule.",
    widget: <ManipulateWidget />,
  },
  {
    n: "03",
    label: "predict",
    title: "Call it before it happens",
    body: "Lessons pause and make you commit. The same seeded run then plays out and proves you right — or wrong, which teaches more.",
    widget: <PredictWidget />,
  },
  {
    n: "04",
    label: "break",
    title: "Kill things on purpose",
    body: "Servers die when you click them. Blast radius, error bursts, failover — felt, not memorized.",
    widget: <BreakWidget />,
  },
] as const;

/** The four verbs as a numbered ledger — hairline rows, not cards. */
export function Vignettes() {
  return (
    <div>
      {VERBS.map((verb) => (
        <div
          key={verb.label}
          className="grid items-center gap-x-8 gap-y-4 border-t border-border py-7 md:grid-cols-[72px_1fr_minmax(220px,260px)] last:border-b"
        >
          <span className="font-display text-3xl font-bold text-fg-faint/50 tabular-nums">
            {verb.n}
          </span>
          <div>
            <p className="tech-label mb-1 text-accent">{verb.label}</p>
            <h3 className="font-display mb-1.5 text-xl font-semibold">
              {verb.title}
            </h3>
            <p className="max-w-lg text-sm leading-relaxed text-fg-muted">
              {verb.body}
            </p>
          </div>
          <div className="md:justify-self-end">{verb.widget}</div>
        </div>
      ))}
    </div>
  );
}
