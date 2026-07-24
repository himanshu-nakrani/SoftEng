"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSyncExternalStore } from "react";
import { mulberry32 } from "./rng";
import {
  createSnapshotStore,
  type SimSnapshot,
  type SnapshotStore,
} from "./snapshot";
import type {
  LessonSim,
  NodeRuntime,
  ParamValue,
  ParamValues,
  QuizCheckpoint,
  SimState,
} from "./types";
import { TICK } from "./types";

export type SimStatus = "paused" | "playing" | "quiz";

/**
 * Meaningful interactions with a running sim, reported outward so the lesson
 * layer can attribute them (a kill, a slider, a quiz answer) without the
 * engine knowing anything about progress or curriculum.
 */
export type SimEvent =
  | { kind: "node-kill" | "param-change" | "button-press"; id: string }
  | { kind: "quiz-answered"; id: string; correct: boolean };

export interface SimControls {
  /** `system: true` marks a non-user play (scroll autoplay) — never engages. */
  play: (opts?: { system?: boolean }) => void;
  pause: () => void;
  toggle: () => void;
  /** Advance exactly one logical tick while paused. */
  stepOnce: () => void;
  /** Re-run init with the same seed — deterministic replay. */
  restart: () => void;
  setSpeed: (multiplier: number) => void;
  setParam: (key: string, value: ParamValue) => void;
  /** Momentary "button" params: sets true; the lesson's step resets it. */
  pressButton: (key: string) => void;
  /** Break-it interaction: toggle a node dead/healthy. */
  toggleNodeHealth: (nodeId: string) => void;
}

export interface Simulation {
  /** Live state — consumed ONLY by PacketLayer (per-frame, imperative). */
  stateRef: { current: SimState<unknown> };
  /** 10Hz snapshot source — read via `useSimSnapshot(simulation)`. */
  store: SnapshotStore;
  /** Per-frame callbacks (PacketLayer subscribes). Runs even while paused. */
  subscribeFrame: (cb: () => void) => () => void;
  controls: SimControls;
  status: SimStatus;
  speed: number;
  /** React mirror of params for controlled inputs. */
  params: ParamValues;
  /** Set while status === "quiz". */
  activeQuiz: QuizCheckpoint | null;
  /** Records the answer; overlay then shows explain + resume button. */
  answerQuiz: (choiceId: string) => void;
  quizAnswer: string | null;
  resumeFromQuiz: () => void;
  /** Fires once on first meaningful interaction (play, param change…). */
  onEngage?: () => void;
}

function defaultParams(specs: LessonSim<unknown>["params"]): ParamValues {
  return Object.fromEntries(specs.map((p) => [p.key, p.defaultValue]));
}

function buildInitialState(
  sim: LessonSim<unknown>,
  seed: number,
): SimState<unknown> {
  const rng = mulberry32(seed);
  const nodes: Record<string, NodeRuntime> = {};
  for (const spec of sim.topology.nodes) {
    nodes[spec.id] = {
      health: "healthy",
      load: 0,
      ...sim.initialNodes?.[spec.id],
    };
  }
  return {
    t: 0,
    packets: [],
    nodes,
    metrics: {},
    lesson: sim.init(rng),
    rng,
    nextPacketId: 1,
  };
}

const CAPTION_DURATION = 4; // sim-seconds a timeline caption stays up

/**
 * The engine core: fixed-timestep (30tps) accumulator loop inside a single
 * rAF; lesson logic is a mutation-friendly reducer; React reads 10Hz
 * snapshots; PacketLayer reads the live ref per frame.
 */
export function useSimulation<L>(
  sim: LessonSim<L>,
  opts: {
    seed?: number;
    onEngage?: () => void;
    onQuizResult?: (quizId: string, choiceId: string, correct: boolean) => void;
    onSimEvent?: (ev: SimEvent) => void;
  } = {},
): Simulation {
  const { seed = 42 } = opts;
  // Engine treats lesson state opaquely; LessonSim is invariant in L, so
  // widen through unknown once here rather than infecting every component.
  const lesson = sim as unknown as LessonSim<unknown>;

  const stateRef = useRef<SimState<unknown> | null>(null);
  if (stateRef.current === null) {
    stateRef.current = buildInitialState(lesson, seed);
  }
  const liveRef = stateRef as { current: SimState<unknown> };

  const paramsRef = useRef<ParamValues>(defaultParams(lesson.params));
  const [params, setParamsState] = useState<ParamValues>(paramsRef.current);
  const [status, setStatus] = useState<SimStatus>("paused");
  const statusRef = useRef<SimStatus>("paused");
  statusRef.current = status;
  const [speed, setSpeedState] = useState(1);
  const speedRef = useRef(1);

  const [activeQuiz, setActiveQuiz] = useState<QuizCheckpoint | null>(null);
  const [quizAnswer, setQuizAnswer] = useState<string | null>(null);
  const firedQuizzes = useRef<Set<string>>(new Set());
  const firedEvents = useRef<Set<number>>(new Set());
  const captionUntil = useRef(0);
  const captionText = useRef<string | null>(null);
  const engaged = useRef(false);

  const store = useMemo(() => createSnapshotStore(liveRef), [liveRef]);

  const frameListeners = useRef<Set<() => void>>(new Set());
  const subscribeFrame = useCallback((cb: () => void) => {
    frameListeners.current.add(cb);
    return () => {
      frameListeners.current.delete(cb);
    };
  }, []);

  // Keep callback opts in a ref so controls stay referentially stable.
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const engage = useCallback(() => {
    if (!engaged.current) {
      engaged.current = true;
      optsRef.current.onEngage?.();
    }
  }, []);

  const emit = useCallback((ev: SimEvent) => {
    optsRef.current.onSimEvent?.(ev);
  }, []);

  /** Advance one logical tick: lesson step + timeline + quiz checkpoints. */
  const tick = useCallback(() => {
    const s = liveRef.current;
    lesson.step(s, TICK, paramsRef.current);
    s.t += TICK;

    // Timeline events crossing t (indexed by array position for the Set).
    lesson.timeline?.forEach((ev, i) => {
      if (s.t >= ev.at && !firedEvents.current.has(i)) {
        firedEvents.current.add(i);
        ev.apply?.(s);
        if (ev.caption) {
          captionText.current = ev.caption;
          captionUntil.current = s.t + CAPTION_DURATION;
        }
      }
    });
    if (captionText.current && s.t > captionUntil.current) {
      captionText.current = null;
    }

    // Quiz checkpoints: hard-pause exactly when t crosses.
    if (lesson.quiz) {
      for (const q of lesson.quiz) {
        if (s.t >= q.at && !firedQuizzes.current.has(q.id)) {
          firedQuizzes.current.add(q.id);
          setActiveQuiz(q);
          setQuizAnswer(null);
          setStatus("quiz");
          // The accumulator loop reads statusRef, which otherwise only catches
          // up on the next render — without this the sim overshoots `at` by
          // however many ticks are still banked (up to ~11 at 2x).
          statusRef.current = "quiz";
          return; // stop ticking this frame
        }
      }
    }
  }, [lesson, liveRef]);

  // The single rAF loop.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let acc = 0;

    const frame = (now: number) => {
      // Clamp long frames (tab switch) so the sim doesn't fast-forward.
      const wallDt = Math.min((now - last) / 1000, 0.1);
      last = now;

      if (statusRef.current === "playing") {
        acc += wallDt * speedRef.current;
        while (acc >= TICK && statusRef.current === "playing") {
          tick();
          acc -= TICK;
        }
        store.maybePublish(now, captionText.current);
      } else {
        // Hard pause (quiz or user): drop banked wall time so resuming can't
        // spend it all in one frame.
        acc = 0;
      }

      // Packet layer syncs every frame (also covers restart-while-paused).
      for (const cb of frameListeners.current) cb();

      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [tick, store]);

  const controls = useMemo<SimControls>(
    () => ({
      play: (playOpts) => {
        // Scroll autoplay is the engine's doing, not the learner's — it must
        // not count as engagement (that would complete every section seen).
        if (playOpts?.system !== true) engage();
        setStatus("playing");
      },
      pause: () => setStatus("paused"),
      toggle: () => {
        engage();
        setStatus((s) => (s === "playing" ? "paused" : s === "paused" ? "playing" : s));
      },
      stepOnce: () => {
        engage();
        if (statusRef.current === "playing") return;
        tick();
        store.publish(captionText.current);
      },
      restart: () => {
        liveRef.current = buildInitialState(lesson, seed);
        firedQuizzes.current.clear();
        firedEvents.current.clear();
        captionText.current = null;
        captionUntil.current = 0;
        setActiveQuiz(null);
        setQuizAnswer(null);
        setStatus("paused");
        store.publish(null);
      },
      setSpeed: (x) => {
        speedRef.current = x;
        setSpeedState(x);
      },
      setParam: (key, value) => {
        engage();
        paramsRef.current = { ...paramsRef.current, [key]: value };
        setParamsState(paramsRef.current);
        emit({ kind: "param-change", id: key });
      },
      pressButton: (key) => {
        engage();
        paramsRef.current = { ...paramsRef.current, [key]: true };
        // No React state mirror needed — momentary.
        emit({ kind: "button-press", id: key });
      },
      toggleNodeHealth: (nodeId) => {
        engage();
        const node = liveRef.current.nodes[nodeId];
        if (!node) return;
        node.health = node.health === "dead" ? "healthy" : "dead";
        if (node.health === "dead") node.load = 0;
        store.publish();
        if (node.health === "dead") emit({ kind: "node-kill", id: nodeId });
      },
    }),
    [emit, engage, lesson, liveRef, seed, store, tick],
  );

  const answerQuiz = useCallback(
    (choiceId: string) => {
      setQuizAnswer(choiceId);
      if (activeQuiz) {
        const correct = choiceId === activeQuiz.correctChoiceId;
        optsRef.current.onQuizResult?.(activeQuiz.id, choiceId, correct);
        emit({ kind: "quiz-answered", id: activeQuiz.id, correct });
      }
    },
    [activeQuiz, emit],
  );

  const resumeFromQuiz = useCallback(() => {
    setActiveQuiz(null);
    setQuizAnswer(null);
    setStatus("playing");
  }, []);

  return {
    stateRef: liveRef,
    store,
    subscribeFrame,
    controls,
    status,
    speed,
    params,
    activeQuiz,
    answerQuiz,
    quizAnswer,
    resumeFromQuiz,
  };
}

/** 10Hz snapshot of the sim for the React (structure) layer. */
export function useSimSnapshot(simulation: Simulation): SimSnapshot {
  return useSyncExternalStore(
    simulation.store.subscribe,
    simulation.store.getSnapshot,
    simulation.store.getServerSnapshot,
  );
}
