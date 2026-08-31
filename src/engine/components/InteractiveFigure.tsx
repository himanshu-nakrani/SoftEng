"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { Maximize2, Minimize2 } from "lucide-react";
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import { CornerTicks } from "@/components/ui/CornerTicks";
import { IconButton } from "@/components/ui/IconButton";
import { Meter } from "@/components/ui/Meter";
import { PlateLabel } from "@/components/ui/PlateLabel";
import { cn } from "@/lib/cn";
import { buildPaths } from "../paths";
import type { LessonSim, LessonSimView, NodeRuntime, NodeSpec, WorkbenchFocus } from "../types";
import { STAGE_H, STAGE_W } from "../types";
import type { SimSnapshot } from "../snapshot";
import {
  useSimulation,
  useSimSnapshot,
  type SimEvent,
  type Simulation,
  type SimControls,
} from "../useSimulation";
import { CaptionOverlay } from "./CaptionOverlay";
import { ControlPanel } from "./ControlPanel";
import { EdgeLine } from "./EdgeLine";
import { FigureErrorBoundary } from "./FigureErrorBoundary";
import { PacketLayer, resolvePacketStyles } from "./PacketLayer";
import { PacketLegend } from "./PacketLegend";
import { SystemNode } from "./SystemNode";
import { PredictionQuiz } from "../interactions/PredictionQuiz";
import {
  CausalEventTape,
  CausalInspector,
  ExperimentCard,
  StaticViewToggle,
} from "./CausalWorkbench";
import {
  TransportBar,
  type ScrubCheckpoint,
  type ScrubEvent,
} from "./TransportBar";

interface InteractiveFigureProps<L> {
  sim: LessonSim<L>;
  /** Accessible description of what the figure shows. */
  description: string;
  /** Start playing when scrolled into view (the "observe" verb). */
  autoplay?: boolean;
  /** Page-level reading mode; changes chrome visibility, never sim state. */
  calibrationMode?: boolean;
  seed?: number;
  /**
   * Deep-linked sim moment: replay to this sim-second once on mount and stay
   * PAUSED there. Set from a `?t=` URL by `SectionFigure` — the review deck
   * links to the exact second a prediction checkpoint asks about.
   *
   * Two rules make it honest, both enforced below:
   * - it SUPPRESSES scroll-autoplay for the life of the figure. Autoplaying
   *   after the seek would spend the sought moment before the learner has seen
   *   it — the deep link is a "look here", so the figure arrives paused and the
   *   learner presses play to watch it resolve.
   * - it fires once per distinct value, never on re-render.
   *
   * Seeking is not an engagement (see `SimControls.seekTo`), so arriving on a
   * deep link never completes a section by itself. Values ≤ 0 or non-finite are
   * ignored: t=0 is where the sim already is, and suppressing autoplay for it
   * would silently break the "observe" verb.
   */
  initialSeekT?: number;
  /**
   * Extra SVG drawn between edges and nodes — lesson-specific stage
   * decoration (a hash ring, a network-partition divider). Receives the
   * live snapshot so it can react to sim state.
   */
  stageOverlay?: (snapshot: SimSnapshot) => ReactNode;
  /**
   * Extra SVG drawn *inside* each node's group — the node's internals (cache
   * slots, a token bucket, a replica log). Called per node per snapshot with
   * that node's runtime; return null for nodes you don't decorate. Coordinates
   * are node-local (origin = top-left of the 88x60 box; see SystemNode's
   * render site for the occupied bands).
   *
   * Snapshot data ONLY — this renders on the React (10Hz) layer and must never
   * reach into the live state ref.
   */
  nodeOverlay?: (
    spec: NodeSpec,
    runtime: SimSnapshot["nodes"][string],
    snapshot: SimSnapshot,
  ) => ReactNode;
  /** First meaningful interaction (drives section completion). */
  onEngage?: () => void;
  onQuizResult?: (quizId: string, choiceId: string, correct: boolean) => void;
  /** Every meaningful interaction, individually attributable. */
  onSimEvent?: (ev: SimEvent) => void;
}

/** Structure layer: subscribes to 10Hz snapshots, renders nodes/edges/meters. */
function StageContent({
  sim,
  simulation,
  stageOverlay,
  nodeOverlay,
  fill,
  activeFocus,
  staticView,
}: {
  sim: LessonSimView;
  simulation: Simulation;
  stageOverlay?: (snapshot: SimSnapshot) => ReactNode;
  nodeOverlay?: InteractiveFigureProps<never>["nodeOverlay"];
  /** Expanded figure: fill the stage box instead of being width-driven. */
  fill?: boolean;
  activeFocus?: WorkbenchFocus;
  /** Explicit static state view, which shares the reduced-motion edge encoding. */
  staticView?: boolean;
}) {
  const snapshot = useSimSnapshot(simulation);
  const registry = useMemo(() => buildPaths(sim.topology), [sim.topology]);
  const reduced = useReducedMotion();
  // One resolution shared by the packets and the edges that stand in for them
  // under reduced motion, so both read the same colors.
  const packetStyles = useMemo(() => resolvePacketStyles(sim), [sim]);
  const interactive = sim.topology.nodes.some((node) => node.breakable);
  const description = liveDescription(snapshot.nodes, sim);
  const staticState = Boolean(reduced || staticView);
  const focusedNodes = new Set(activeFocus?.nodes ?? []);
  const focusedEdges = new Set(activeFocus?.edges ?? []);

  return (
    <>
      <svg
        viewBox={`0 0 ${STAGE_W} ${STAGE_H}`}
        // Width-driven in flow; height-driven when the figure owns the screen,
        // where preserveAspectRatio's default centres the drawing for us. Same
        // viewBox either way, so nothing in the sim knows the difference.
        className={fill ? "block size-full" : "block h-auto w-full"}
        data-sim-stage
        role={interactive ? "group" : "img"}
        aria-roledescription={interactive ? "interactive system diagram" : undefined}
        aria-label={
          interactive
            ? `${description} Activate a component to toggle its failure state.`
            : description
        }
      >
        <defs>
          <pattern
            id={`dots-${sim.id}`}
            width={24}
            height={24}
            patternUnits="userSpaceOnUse"
          >
            <circle cx={1} cy={1} r={1} fill="var(--color-border)" />
          </pattern>
        </defs>
        <rect
          width={STAGE_W}
          height={STAGE_H}
          fill={`url(#dots-${sim.id})`}
          opacity={0.5}
        />
        {/* plate graticule — a fine tick scale along the bottom and left
            edges, taller at every fifth division. Ruler marginalia framing
            the drawing, not data: inert, decorative, unmeasured. */}
        <g
          aria-hidden
          stroke="var(--color-border-bright)"
          strokeWidth={1}
          opacity={0.55}
        >
          {Array.from({ length: 21 }, (_, i) => {
            const x = i * (STAGE_W / 20);
            return (
              <line
                key={`b${i}`}
                x1={x}
                y1={STAGE_H}
                x2={x}
                y2={STAGE_H - (i % 5 === 0 ? 9 : 4)}
              />
            );
          })}
          {Array.from({ length: 10 }, (_, i) => {
            const y = STAGE_H - i * (STAGE_H / 9);
            return (
              <line
                key={`l${i}`}
                x1={0}
                y1={y}
                x2={i % 5 === 0 ? 9 : 4}
                y2={y}
              />
            );
          })}
        </g>

        {sim.topology.edges.map((edge) => {
          const path = registry.get(edge.id)!;
          const target = snapshot.nodes[edge.to];
          return (
            <EdgeLine
              key={edge.id}
              path={path}
              dimmed={target?.health === "dead" || target?.ghost}
              // Reduced motion hides the packets, so the edges have to say
              // where the traffic is. Normal motion passes nothing extra and
              // renders exactly as before.
              reducedMotion={staticState}
              activity={staticState ? snapshot.edgeActivity[edge.id] : undefined}
              packetStyles={packetStyles}
              focused={focusedEdges.has(edge.id)}
            />
          );
        })}

        {stageOverlay?.(snapshot)}

        <PacketLayer
          simulation={simulation}
          registry={registry}
          hidden={staticState}
          sim={sim}
        />

        {sim.topology.nodes.map((spec) => {
          const runtime = snapshot.nodes[spec.id] ?? {
            health: "healthy" as const,
            load: 0,
          };
          return (
            <SystemNode
              key={spec.id}
              spec={spec}
              runtime={runtime}
              onToggleHealth={
                spec.breakable
                  ? simulation.controls.toggleNodeHealth
                  : undefined
              }
              overlay={nodeOverlay?.(spec, runtime, snapshot)}
              focused={focusedNodes.has(spec.id)}
            />
          );
        })}
      </svg>
      <CaptionOverlay caption={snapshot.caption} />
    </>
  );
}

function liveDescription(
  nodes: Record<string, NodeRuntime>,
  sim: LessonSimView,
): string {
  const dead = sim.topology.nodes.filter(
    (n) => nodes[n.id]?.health === "dead",
  );
  return dead.length
    ? `System diagram. Failed components: ${dead.map((n) => n.label).join(", ")}.`
    : "System diagram. All components healthy.";
}

function MetersRow({
  sim,
  simulation,
  activeFocus,
}: {
  sim: LessonSimView;
  simulation: Simulation;
  activeFocus?: WorkbenchFocus;
}) {
  const snapshot = useSimSnapshot(simulation);
  if (sim.meters.length === 0) return null;
  return (
    <div className="sim-meters grid grid-cols-2 gap-y-3 border-t border-border px-4 py-3 sm:flex sm:flex-wrap sm:items-stretch">
      {sim.meters.map((spec, i) => (
        <div
          key={spec.metricKey}
          className={
            cn(
              i === 0
                ? "sm:pr-6"
                : "sm:border-l sm:border-border sm:px-6 max-sm:odd:pl-4",
              activeFocus?.metrics?.includes(spec.metricKey) && "causal-meter-focus",
            )
          }
        >
          <Meter
            spec={spec}
            value={snapshot.metrics[spec.metricKey] ?? 0}
            series={snapshot.series[spec.metricKey]}
          />
        </div>
      ))}
    </div>
  );
}

function Clock({
  sim,
  simulation,
  controls,
}: {
  /** Structural: LessonSimView omits timeline/quiz, and LessonSim is invariant. */
  sim: { timeline?: readonly ScrubEvent[]; quiz?: readonly ScrubCheckpoint[] };
  simulation: Simulation;
  /** User-facing controls — see `uiControls`; pausing here cancels scroll-resume. */
  controls: SimControls;
}) {
  const snapshot = useSimSnapshot(simulation);
  return (
    <TransportBar
      status={simulation.status}
      speed={simulation.speed}
      t={snapshot.t}
      controls={controls}
      furthestT={simulation.furthestT}
      timeline={sim.timeline}
      quiz={sim.quiz}
      captionLog={simulation.captionLog}
      captionLogVersion={simulation.captionLogVersion}
    />
  );
}

/**
 * THE single entry point for lesson visualizations: stage + meters +
 * controls + transport + quiz overlay. Lesson pages compose nothing else.
 *
 * The whole figure — including the `useSimulation` call that owns the runner —
 * lives inside a `FigureErrorBoundary`. That placement is load-bearing: a
 * lesson `step` that throws is captured in the rAF loop and re-thrown during
 * `FigureBody`'s render, so the boundary must sit *above* the component
 * holding the hook. Restarting the boundary remounts `FigureBody`, which
 * builds a fresh runner from the seed.
 */
export function InteractiveFigure<L>(props: InteractiveFigureProps<L>) {
  return (
    <FigureErrorBoundary label={props.sim.id}>
      <FigureBody {...props} />
    </FigureErrorBoundary>
  );
}

function FigureBody<L>({
  sim,
  description,
  autoplay = true,
  calibrationMode = false,
  seed,
  initialSeekT,
  stageOverlay,
  nodeOverlay,
  onEngage,
  onQuizResult,
  onSimEvent,
}: InteractiveFigureProps<L>) {
  const simulation = useSimulation(sim, {
    seed,
    onEngage,
    onQuizResult,
    onSimEvent,
  });
  const containerRef = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const snapshot = useSimSnapshot(simulation);
  const workbench = sim.workbench;
  const [expanded, setExpanded] = useState(false);
  const [staticView, setStaticView] = useState(false);
  const [activeFocusId, setActiveFocusId] = useState<string | undefined>(
    workbench?.experiment?.focusId ?? workbench?.focuses[0]?.id,
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>(
    workbench?.focuses[0]?.nodes?.[0] ?? sim.topology.nodes[0]?.id,
  );
  const activeFocus = workbench?.focuses.find((focus) => focus.id === activeFocusId);

  // Any breakable node makes this figure a *touch* target at every width, not
  // just a small one — so it earns the expand affordance on desktop too.
  const hasBreakable = useMemo(
    () => sim.topology.nodes.some((n) => n.breakable),
    [sim.topology.nodes],
  );

  // Expanded: Escape exits and the page behind stops scrolling. The previous
  // inline value is restored rather than cleared — another figure (or a drawer)
  // may have set it.
  useEffect(() => {
    if (!expanded) return;
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [expanded]);

  // Observe verb: autoplay on first scroll-into-view; pause when off-screen.
  const selectFocus = (focus: WorkbenchFocus, seek = true) => {
    setActiveFocusId(focus.id);
    if (focus.nodes?.[0]) setSelectedNodeId(focus.nodes[0]);
    // uiControls: a focus seek is the learner taking control, so it must also
    // cancel a still-pending autoplay (see the `mark` note).
    if (seek && focus.at !== undefined) uiControls.seekTo(focus.at);
  };

  const dismissQuizAndReturnToFigure = () => {
    simulation.dismissQuiz();
    /**
     * The quiz exits through AnimatePresence. The figure survives that exit and
     * is the stable, labelled keyboard surface where a learner can inspect the
     * paused system or invoke its documented shortcuts.
     *
     * Focus is RETRIED rather than set once. A single `requestAnimationFrame`
     * lands while the dialog is still mounted and still trapping focus, so the
     * figure was handed focus and immediately lost it again — leaving the
     * keyboard user on `<body>` with the figure's shortcuts unreachable. Each
     * attempt checks whether it actually took, and stops as soon as it did.
     */
    let attempts = 0;
    const focusFigure = () => {
      const el = containerRef.current;
      if (!el) return;
      el.focus();
      // ~10 frames is longer than the exit transition and short enough that a
      // genuinely un-focusable figure does not spin.
      if (document.activeElement !== el && attempts++ < 10) {
        requestAnimationFrame(focusFigure);
      }
    };
    requestAnimationFrame(focusFigure);
  };

  const startExperiment = () => {
    const experiment = workbench?.experiment;
    if (!experiment) return;
    const focus = workbench?.focuses.find((item) => item.id === experiment.focusId);
    if (focus) selectFocus(focus, false);
    switch (experiment.action.kind) {
      case "play":
        uiControls.play();
        break;
      case "seek":
        uiControls.seekTo(experiment.action.at);
        break;
      case "button":
        simulation.controls.pressButton(experiment.action.id);
        break;
      case "param":
        simulation.controls.setParam(experiment.action.id, experiment.action.value);
        break;
    }
  };


  const applyParam = (key: string, value: Parameters<typeof simulation.controls.setParam>[1]) => {
    simulation.controls.setParam(key, value);
    const triggered = workbench?.focuses.find(
      (focus) => focus.trigger?.kind === "param-change" && focus.trigger.id === key,
    );
    if (triggered) selectFocus(triggered, false);
  };

  const pressScenario = (key: string) => {
    simulation.controls.pressButton(key);
    const triggered = workbench?.focuses.find(
      (focus) => focus.trigger?.kind === "button-press" && focus.trigger.id === key,
    );
    if (triggered) selectFocus(triggered, false);
  };

  const controlsRef = useRef(simulation.controls);
  controlsRef.current = simulation.controls;
  const statusRef = useRef(simulation.status);
  statusRef.current = simulation.status;

  /**
   * A deep-linked moment claims the transport (see `initialSeekT`). The flag is
   * mirrored into a ref because the IntersectionObserver callback below reads
   * it: `?t=` arrives from an effect one render AFTER mount, by which time the
   * observer may already be subscribed with a stale closure, and a queued
   * callback landing after the seek would otherwise autoplay straight over the
   * state we just replayed to.
   */
  const seekRequested =
    typeof initialSeekT === "number" &&
    Number.isFinite(initialSeekT) &&
    initialSeekT > 0;
  const seekRequestedRef = useRef(seekRequested);
  seekRequestedRef.current = seekRequested;

  // Fire once per distinct target. Re-running on every render would restart the
  // world under the learner; keying on the value (rather than a bare "done"
  // flag) means a client-side navigation to the same lesson at a different `?t=`
  // still lands where it was asked to.
  const seekedToRef = useRef<number | null>(null);
  useEffect(() => {
    if (!seekRequested || seekedToRef.current === initialSeekT) return;
    seekedToRef.current = initialSeekT ?? null;
    controlsRef.current.seekTo(initialSeekT!);
  }, [initialSeekT, seekRequested]);

  /**
   * Whether scroll-autoplay has already fired for this figure.
   *
   * A ref, NOT a closure variable inside the effect below. `useReducedMotion()`
   * returns null on the first render and settles to a boolean after mount, so
   * the effect's `[autoplay, reduced]` deps change once and it re-runs — which
   * resubscribes the observer, whose callback fires again with the figure still
   * on screen. With a per-effect `everPlayed` that second callback autoplayed a
   * second time, overriding a pause the learner had already pressed. Surviving
   * the re-run is the whole point: autoplay is once per figure, not once per
   * effect.
   */
  const everPlayedRef = useRef(false);

  /**
   * True when the observer paused the sim because the figure left the viewport,
   * so scrolling back can resume what the learner was watching.
   *
   * Also a ref, so an EXPLICIT pause can clear it (see `uiControls`) — otherwise
   * a small scroll during a manual pause could re-cross the 0.35 threshold and
   * resume against the learner's intent.
   */
  const pausedByScrollRef = useRef(false);

  /** Pending scroll decision — see the observer below. */
  const settleRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * The controls handed to every USER-facing surface (transport, keyboard).
   *
   * An explicit play/pause is intent, so it cancels any pending scroll decision
   * and disarms any armed scroll-resume: the learner outranks the viewport. It
   * also updates `statusRef` EAGERLY, which is otherwise assigned during render,
   * so an observer callback landing before React re-renders cannot read a stale
   * status.
   *
   * Wrapping `toggle` matters as much as `pause`: the Space shortcut dispatches
   * `toggle`, so wrapping `pause` alone would cover nothing.
   */
  const uiControls: SimControls = (() => {
    /**
     * Record that the learner has taken the wheel.
     *
     * `everPlayedRef` is set here too, which is the important part: the settled
     * observer decision can still be pending when a learner seeks or presses
     * play, and a pending autoplay firing afterwards would stomp the state they
     * just chose. Same hazard the `seekRequested` guard covers for deep links —
     * this covers it for in-page interaction.
     */
    const mark = (next: "playing" | "paused") => {
      if (settleRef.current) clearTimeout(settleRef.current);
      settleRef.current = null;
      pausedByScrollRef.current = false;
      everPlayedRef.current = true;
      statusRef.current = next;
    };
    return {
      ...simulation.controls,
      play: (opts) => {
        mark("playing");
        simulation.controls.play(opts);
      },
      pause: () => {
        mark("paused");
        simulation.controls.pause();
      },
      toggle: () => {
        mark(statusRef.current === "playing" ? "paused" : "playing");
        simulation.controls.toggle();
      },
      // Seeking pauses in the engine; mirroring that here keeps a pending
      // autoplay from resuming a moment the learner deliberately scrubbed to.
      seekTo: (t) => {
        mark("paused");
        simulation.controls.seekTo(t);
      },
    };
    // Not memoized: the React Compiler declines to optimize a component whose
    // manual memoization it cannot preserve, and this object is cheap — it is
    // consumed by the transport, which re-renders on every status change anyway.
  })();

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    /**
     * Act only on a SETTLED intersection.
     *
     * A scroll is not one event. `scrollIntoView`, an anchor jump, or simply
     * clicking a control near the bottom of a tall figure (they run to ~1150px,
     * taller than a laptop viewport) drags the visible ratio across the 0.35
     * threshold several times within a few frames. Reacting to each crossing
     * made the engine pause and resume ~17ms apart — measured, not guessed —
     * which fought the learner and made the "play advances the sim clock" smoke
     * test fail 9 runs in 10.
     *
     * 180ms outlasts a scroll animation while still stopping a figure promptly
     * once it is genuinely scrolled away.
     */
    const SETTLE_MS = 180;

    const apply = (isIntersecting: boolean) => {
      settleRef.current = null;
      if (isIntersecting) {
        // `pausedByScroll` is exempt from the seek suppression on purpose: it
        // only becomes true after a *user* pressed play, so resuming what
        // they started is not the engine overwriting a deep link.
        const shouldAutoplay =
          autoplay && !reduced && !everPlayedRef.current && !seekRequestedRef.current;
        if (shouldAutoplay || pausedByScrollRef.current) {
          everPlayedRef.current = true;
          pausedByScrollRef.current = false;
          controlsRef.current.play({ system: true });
        }
      } else if (statusRef.current === "playing") {
        pausedByScrollRef.current = true;
        controlsRef.current.pause();
      }
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (settleRef.current) clearTimeout(settleRef.current);
        settleRef.current = setTimeout(
          () => apply(entry.isIntersecting),
          SETTLE_MS,
        );
      },
      { threshold: 0.35 },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      if (settleRef.current) clearTimeout(settleRef.current);
      settleRef.current = null;
    };
  }, [autoplay, reduced]);

  /**
   * Figure-level transport shortcuts. They live here rather than on the
   * transport buttons so a shortcut works anywhere inside the figure — which is
   * the contract `TransportBar`'s `aria-keyshortcuts` already advertises.
   *
   * Anything that is itself a control keeps its own keys (Space on a button is
   * activation; arrows on the speed radiogroup are selection), and a fired
   * checkpoint owns the keyboard outright — resuming a quizzed sim with Space
   * would skip the prediction the overlay is waiting on.
   */
  const onFigureKeyDown = (e: ReactKeyboardEvent<HTMLElement>) => {
    if (simulation.status === "quiz") return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const target = e.target;
    if (
      target instanceof Element &&
      target.closest(
        "button,input,select,textarea,a,[role=radio],[role=button],[role=switch]",
      )
    ) {
      return;
    }

    // uiControls, not simulation.controls: Space must honour a pause the same
    // way the transport button does (see the uiControls note above).
    const controls = uiControls;
    switch (e.key) {
      case " ":
      case "k":
      case "K":
        e.preventDefault();
        controls.toggle();
        break;
      case ".":
        e.preventDefault();
        controls.stepOnce();
        break;
      case "r":
      case "R":
        e.preventDefault();
        controls.restart();
        break;
      case "1":
        e.preventDefault();
        controls.setSpeed(0.5);
        break;
      case "2":
        e.preventDefault();
        controls.setSpeed(1);
        break;
      case "3":
        e.preventDefault();
        controls.setSpeed(2);
        break;
      default:
        break;
    }
  };

  return (
    <figure
      ref={containerRef}
      data-calibration={calibrationMode ? "true" : undefined}
      /**
       * The transport's state, as a stable contract for e2e and for debugging.
       * Tests previously inferred it from a button's aria-label, which conflates
       * two different questions ("has this hydrated?" and "is it running?") and
       * breaks whenever a label is reworded.
       */
      data-sim-status={simulation.status}
      // ONE element, ONE class list — expanding swaps `className` on the very
      // same node in the very same position, so React reconciles in place and
      // the running sim (runner, RNG cursor, quiz progress) is untouched.
      className={cn(
        "sim-figure border-border bg-surface",
        expanded
          ? "fixed inset-0 z-50 m-0 flex flex-col overflow-y-auto rounded-none border-0"
          : "my-8 overflow-hidden rounded-xl border",
      )}
      tabIndex={0}
      onKeyDown={onFigureKeyDown}
      aria-keyshortcuts="Space . R 1 2 3"
    >
      <div className={cn("sim-figure-stage relative", expanded && "min-h-0 flex-1")}>
        <StageContent
          sim={sim}
          simulation={simulation}
          stageOverlay={stageOverlay}
          nodeOverlay={nodeOverlay}
          fill={expanded}
          activeFocus={activeFocus}
          staticView={staticView}
        />
        <CornerTicks />
        {/* Top-right rail: the figure plate (every sim is a numbered
            schematic) and the expand toggle, in one row so neither has to
            dodge the other. The rail itself takes pointer events; the plate
            opts back out. */}
        <div className="absolute top-2 right-2.5 flex items-center gap-2.5">
          <PlateLabel>fig · {sim.id} · seed {seed ?? 42}</PlateLabel>
          {workbench && (
            <StaticViewToggle
              active={staticView}
              onToggle={() => setStaticView((value) => !value)}
            />
          )}
          <IconButton
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            label={
              expanded
                ? "Exit full screen and return the figure to the page"
                : "Expand the figure to full screen"
            }
            title={expanded ? "Exit full screen (Esc)" : "Expand to full screen"}
            variant="bordered"
            size="sm"
            className={cn(
              "shrink-0",
              // Small stages always get it; a stage you are meant to *poke*
              // gets it at every width. Expanded always shows the way out.
              expanded || hasBreakable ? "flex" : "flex lg:hidden",
            )}
          >
            {expanded ? (
              <Minimize2 className="size-3.5" strokeWidth={1.75} />
            ) : (
              <Maximize2 className="size-3.5" strokeWidth={1.75} />
            )}
          </IconButton>
        </div>
        <PredictionQuiz
          quiz={simulation.activeQuiz}
          answer={simulation.quizAnswer}
          onAnswer={simulation.answerQuiz}
          onDismiss={dismissQuizAndReturnToFigure}
          onResume={simulation.resumeFromQuiz}
        />
      </div>
      <figcaption className="sr-only">{description}</figcaption>
      {workbench?.experiment && (
        <div className="calibration-secondary">
          <ExperimentCard
            experiment={workbench.experiment}
            focus={activeFocus}
            onStart={startExperiment}
          />
        </div>
      )}
      {workbench && (
        <CausalEventTape
          focuses={workbench.focuses}
          activeId={activeFocus?.id}
          onSelect={selectFocus}
        />
      )}
      {/* Directly under the stage, above the instruments: the key belongs next
          to the thing it explains, and it stays out of the meters row, whose
          flex dividers and 2-column mobile grid a chip row would break. Renders
          nothing — not an empty strip — for sims with no `packetLegend`. */}
      <div className="calibration-secondary">
        <PacketLegend sim={sim} />
        <MetersRow sim={sim} simulation={simulation} activeFocus={activeFocus} />
      </div>
      <div className="calibration-secondary">
        {workbench && (
          <CausalInspector
            focus={activeFocus}
            nodes={sim.topology.nodes}
            snapshotNodes={snapshot.nodes}
            selectedNodeId={selectedNodeId}
            onSelectNode={setSelectedNodeId}
            onRestart={simulation.controls.restart}
          />
        )}
        <ControlPanel
          specs={sim.params}
          values={simulation.params}
          onChange={applyParam}
          onPress={pressScenario}
        />
        <Clock sim={sim} simulation={simulation} controls={uiControls} />
      </div>
    </figure>
  );
}
