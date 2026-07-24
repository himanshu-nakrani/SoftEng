"use client";

import { useEffect, useMemo, useRef } from "react";
import { useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { CornerTicks } from "@/components/ui/CornerTicks";
import { buildPaths } from "../paths";
import type {
  LessonSim,
  LessonSimView,
  NodeRuntime,
  ParamValues,
} from "../types";
import { STAGE_H, STAGE_W } from "../types";
import type { SimSnapshot } from "../snapshot";
import { useSimulation, useSimSnapshot, type Simulation } from "../useSimulation";
import { CaptionOverlay } from "./CaptionOverlay";
import { ControlPanel } from "./ControlPanel";
import { EdgeLine } from "./EdgeLine";
import { Meter } from "./Meter";
import { PacketLayer } from "./PacketLayer";
import { SystemNode } from "./SystemNode";
import { PredictionQuiz } from "../interactions/PredictionQuiz";
import { TransportBar } from "./TransportBar";

interface InteractiveFigureProps<L> {
  sim: LessonSim<L>;
  /** Accessible description of what the figure shows. */
  description: string;
  /** Start playing when scrolled into view (the "observe" verb). */
  autoplay?: boolean;
  seed?: number;
  /**
   * Extra SVG drawn between edges and nodes — lesson-specific stage
   * decoration (a hash ring, a network-partition divider). Receives the
   * live snapshot so it can react to sim state.
   */
  stageOverlay?: (snapshot: SimSnapshot) => ReactNode;
  /** Override default param values at init (playground share links). */
  initialParams?: ParamValues;
  /** Fires after every user param change (playground URL sync). */
  onParamsChange?: (params: ParamValues) => void;
  /** First meaningful interaction (drives section completion). */
  onEngage?: () => void;
  onQuizResult?: (quizId: string, correct: boolean) => void;
}

/** Structure layer: subscribes to 10Hz snapshots, renders nodes/edges/meters. */
function StageContent({
  sim,
  simulation,
  stageOverlay,
}: {
  sim: LessonSimView;
  simulation: Simulation;
  stageOverlay?: (snapshot: SimSnapshot) => ReactNode;
}) {
  const snapshot = useSimSnapshot(simulation);
  const registry = useMemo(() => buildPaths(sim.topology), [sim.topology]);
  const reduced = useReducedMotion();

  return (
    <>
      <svg
        viewBox={`0 0 ${STAGE_W} ${STAGE_H}`}
        className="block h-auto w-full"
        role="img"
        aria-label={liveDescription(snapshot.nodes, sim)}
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

        {sim.topology.edges.map((edge) => {
          const path = registry.get(edge.id)!;
          const target = snapshot.nodes[edge.to];
          return (
            <EdgeLine
              key={edge.id}
              path={path}
              dimmed={target?.health === "dead" || target?.ghost}
            />
          );
        })}

        {stageOverlay?.(snapshot)}

        <PacketLayer
          simulation={simulation}
          registry={registry}
          hidden={Boolean(reduced)}
        />

        {sim.topology.nodes.map((spec) => (
          <SystemNode
            key={spec.id}
            spec={spec}
            runtime={
              snapshot.nodes[spec.id] ?? { health: "healthy", load: 0 }
            }
            onToggleHealth={
              spec.breakable ? simulation.controls.toggleNodeHealth : undefined
            }
          />
        ))}
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
}: {
  sim: LessonSimView;
  simulation: Simulation;
}) {
  const snapshot = useSimSnapshot(simulation);
  if (sim.meters.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-y-3 border-t border-border px-4 py-3 sm:flex sm:flex-wrap sm:items-stretch">
      {sim.meters.map((spec, i) => (
        <div
          key={spec.metricKey}
          className={
            i === 0
              ? "sm:pr-6"
              : "sm:border-l sm:border-border sm:px-6 max-sm:odd:pl-4"
          }
        >
          <Meter spec={spec} value={snapshot.metrics[spec.metricKey] ?? 0} />
        </div>
      ))}
    </div>
  );
}

function Clock({ simulation }: { simulation: Simulation }) {
  const snapshot = useSimSnapshot(simulation);
  return (
    <TransportBar
      status={simulation.status}
      speed={simulation.speed}
      t={snapshot.t}
      controls={simulation.controls}
    />
  );
}

/* Keyboard transport coordination: many figures can share a page; the one
   most recently scrolled into view claims the keys. */
const visibleFigures = new Set<symbol>();
let activeFigure: symbol | null = null;

/**
 * THE single entry point for lesson visualizations: stage + meters +
 * controls + transport + quiz overlay. Lesson pages compose nothing else.
 */
export function InteractiveFigure<L>({
  sim,
  description,
  autoplay = true,
  seed,
  stageOverlay,
  initialParams,
  onParamsChange,
  onEngage,
  onQuizResult,
}: InteractiveFigureProps<L>) {
  const simulation = useSimulation(sim, {
    seed,
    initialParams,
    onParamsChange,
    onEngage,
    onQuizResult,
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  // Observe verb: autoplay on first scroll-into-view; pause when off-screen.
  const controlsRef = useRef(simulation.controls);
  controlsRef.current = simulation.controls;
  const statusRef = useRef(simulation.status);
  statusRef.current = simulation.status;
  const keyToken = useRef(Symbol("figure")).current;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let everPlayed = false;
    let pausedByScroll = false;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // Claim keyboard transport (most recently visible wins).
          visibleFigures.add(keyToken);
          activeFigure = keyToken;
          const shouldAutoplay = autoplay && !reduced && !everPlayed;
          if (shouldAutoplay || pausedByScroll) {
            everPlayed = true;
            pausedByScroll = false;
            controlsRef.current.play();
          }
        } else {
          visibleFigures.delete(keyToken);
          if (activeFigure === keyToken) {
            activeFigure = visibleFigures.values().next().value ?? null;
          }
          if (statusRef.current === "playing") {
            pausedByScroll = true;
            controlsRef.current.pause();
          }
        }
      },
      { threshold: 0.35 },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      visibleFigures.delete(keyToken);
      if (activeFigure === keyToken) {
        activeFigure = visibleFigures.values().next().value ?? null;
      }
    };
  }, [autoplay, reduced, keyToken]);

  // A1: keyboard transport — Space play/pause · "." step · R restart · 1/2/3 speed.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (activeFigure !== keyToken) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (statusRef.current === "quiz") return; // quiz overlay owns the moment
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable]")) return;

      const controls = controlsRef.current;
      switch (e.key) {
        case " ":
          e.preventDefault(); // don't scroll the page
          controls.toggle();
          break;
        case ".":
          controls.stepOnce();
          break;
        case "r":
        case "R":
          controls.restart();
          break;
        case "1":
          controls.setSpeed(0.5);
          break;
        case "2":
          controls.setSpeed(1);
          break;
        case "3":
          controls.setSpeed(2);
          break;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [keyToken]);

  return (
    <figure
      ref={containerRef}
      className="my-6 overflow-hidden rounded-lg border border-border bg-surface"
    >
      <div className="relative bg-bg/40">
        <StageContent
          sim={sim}
          simulation={simulation}
          stageOverlay={stageOverlay}
        />
        <CornerTicks />
        {/* figure plate — every sim is a numbered schematic */}
        <span
          aria-hidden
          className="pointer-events-none absolute top-2.5 right-5 font-mono text-[9px] tracking-[0.12em] text-fg-faint/80 uppercase"
        >
          fig · {sim.id} · seed {seed ?? 42}
        </span>
        <PredictionQuiz
          quiz={simulation.activeQuiz}
          answer={simulation.quizAnswer}
          onAnswer={simulation.answerQuiz}
          onResume={simulation.resumeFromQuiz}
        />
      </div>
      <figcaption className="sr-only">{description}</figcaption>
      <MetersRow sim={sim} simulation={simulation} />
      <ControlPanel
        specs={sim.params}
        values={simulation.params}
        onChange={simulation.controls.setParam}
        onPress={simulation.controls.pressButton}
      />
      <Clock simulation={simulation} />
    </figure>
  );
}
