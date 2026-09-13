/**
 * Shared instrument chrome for figure controls.
 *
 * Packet figures and step figures used to restyle the same verbs (strip,
 * value chip, transport row, clock) independently; the two bars then drifted.
 * These class recipes are the freeze.
 */

/** Live param row under a figure (sliders, toggles, scenario buttons). */
export const CONTROL_STRIP =
  "flex flex-wrap items-end gap-x-5 gap-y-2.5 border-t border-border/60 bg-surface/30 px-3.5 py-2";

/** Play/pause/speed/scrub row. */
export const TRANSPORT_ROW =
  "flex flex-wrap items-center gap-1 border-t border-border/50 bg-surface/30 px-3.5 py-1.5";

/** Numeric readout next to a slider label. */
export const CONTROL_VALUE =
  "tech-num shrink-0 rounded-md border border-accent/25 bg-accent-dim/40 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-accent tabular-nums shadow-xs";

/** Sim-clock / step-index chip at the end of a transport row. */
export const CLOCK_CHIP =
  "tech-num flex shrink-0 items-center gap-2 rounded-md border border-border/60 bg-surface/80 px-2 py-0.5 text-xs whitespace-nowrap text-fg font-mono shadow-xs";

export const INSTRUMENT_DIVIDER = "mx-2 h-4 w-px bg-border";

/** Shuffle / reseed — a quiet instrument, not a page CTA. */
export const INSTRUMENT_BUTTON =
  "flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-border bg-surface/60 px-3 py-1.5 font-mono text-[11px] text-fg-muted transition-[border-color,color,background-color,transform] duration-150 ease-[var(--ease-out-soft)] hover:border-border-bright hover:bg-raised hover:text-fg active:scale-95";
