"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSyncExternalStore } from "react";
import { createRunner, type SimRunner } from "./runner";
import {
  createSnapshotStore,
  type SimSnapshot,
  type SnapshotStore,
} from "./snapshot";
import type {
  LessonSim,
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
  activeQuiz: QuizCheckpoint<unknown> | null;
  /** Records the answer; overlay then shows explain + resume button. */
  answerQuiz: (choiceId: string) => void;
  quizAnswer: string | null;
  resumeFromQuiz: () => void;
  /** Fires once on first meaningful interaction (play, param change…). */
  onEngage?: () => void;
}

/**
 * React binding over the headless `SimRunner` (see ./runner): fixed-timestep
 * (30tps) accumulator loop inside a single rAF; the runner advances the world,
 * this hook owns play/pause policy, React mirrors, and the 10Hz snapshot the
 * structure layer renders from. PacketLayer reads the live ref per frame.
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

  const runnerRef = useRef<SimRunner | null>(null);
  if (runnerRef.current === null) {
    runnerRef.current = createRunner(sim, { seed });
  }
  const runner = runnerRef.current;

  // PacketLayer and the snapshot store read through a stable ref cell; the
  // runner replaces its state object on restart, so re-point it there.
  const stateRef = useRef<SimState<unknown> | null>(null);
  if (stateRef.current === null) {
    stateRef.current = runner.state;
  }
  const liveRef = stateRef as { current: SimState<unknown> };

  const [params, setParamsState] = useState<ParamValues>(runner.params);
  const [status, setStatus] = useState<SimStatus>("paused");
  const statusRef = useRef<SimStatus>("paused");
  statusRef.current = status;
  const [speed, setSpeedState] = useState(1);
  const speedRef = useRef(1);

  const [activeQuiz, setActiveQuiz] = useState<QuizCheckpoint<unknown> | null>(
    null,
  );
  const [quizAnswer, setQuizAnswer] = useState<string | null>(null);
  const engaged = useRef(false);
  const [tickError, setTickError] = useState<Error | null>(null);

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

  /**
   * A lesson's `step` is ordinary authored code running inside the rAF loop —
   * where a throw is invisible to React: it kills this figure's animation
   * frame and nothing else happens. So catch it here, hard-pause, and stash
   * it; the render pass below re-throws it, which is the only form React can
   * route to `FigureErrorBoundary`. First error wins (later frames of a
   * corrupted world would only report noise).
   */
  const fail = useCallback((cause: unknown) => {
    setStatus("paused");
    // The loop reads the ref, not the state — stop it before the next frame
    // rather than a render later.
    statusRef.current = "paused";
    setTickError((prev) =>
      prev ?? (cause instanceof Error ? cause : new Error(String(cause))),
    );
  }, []);

  /** One logical tick, plus this layer's policy: a crossed quiz hard-pauses. */
  const tick = useCallback(() => {
    const { firedQuiz } = runner.tick();
    if (firedQuiz) {
      setActiveQuiz(firedQuiz);
      setQuizAnswer(null);
      setStatus("quiz");
      // The accumulator loop reads statusRef, which otherwise only catches
      // up on the next render — without this the sim overshoots `at` by
      // however many ticks are still banked (up to ~11 at 2x).
      statusRef.current = "quiz";
    }
  }, [runner]);

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
        try {
          while (acc >= TICK && statusRef.current === "playing") {
            tick();
            acc -= TICK;
          }
          store.maybePublish(now, runner.caption);
        } catch (err) {
          // Stop the loop dead: no successor frame is scheduled, so a
          // half-stepped world is never advanced or drawn again. The next
          // render throws into FigureErrorBoundary and unmounts this subtree.
          fail(err);
          return;
        }
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
  }, [tick, store, runner, fail]);

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
        try {
          tick();
          store.publish(runner.caption);
        } catch (err) {
          fail(err);
        }
      },
      restart: () => {
        runner.restart();
        liveRef.current = runner.state;
        setActiveQuiz(null);
        setQuizAnswer(null);
        setStatus("paused");
        store.publish(null);
      },
      setSpeed: (x) => {
        speedRef.current = x;
        setSpeedState(x);
        // Caption expiry is counted in sim-seconds, so faster playback would
        // shorten reading time (4 sim-seconds is 2 real seconds at 2x). Scale
        // the duration by the same multiplier to hold display time constant.
        // Display-only — see `SimRunner.setCaptionScale`.
        runner.setCaptionScale(x);
      },
      setParam: (key, value) => {
        engage();
        runner.setParam(key, value);
        setParamsState(runner.params);
        emit({ kind: "param-change", id: key });
      },
      pressButton: (key) => {
        engage();
        runner.pressButton(key);
        // A momentary param is consumed by the lesson's next `step`, so on a
        // paused sim the press would look like it did nothing until the
        // learner also hit play. Pressing a scenario button IS a request to
        // see it happen: resume. Only from "paused" — resuming out of "quiz"
        // would skip the checkpoint the sim is waiting on.
        if (statusRef.current === "paused") setStatus("playing");
        // No React state mirror needed — momentary.
        emit({ kind: "button-press", id: key });
      },
      toggleNodeHealth: (nodeId) => {
        engage();
        const node = liveRef.current.nodes[nodeId];
        if (!node) return;
        try {
          node.health = node.health === "dead" ? "healthy" : "dead";
          if (node.health === "dead") node.load = 0;
          store.publish();
          if (node.health === "dead") emit({ kind: "node-kill", id: nodeId });
        } catch (err) {
          // React does not route event-handler throws to boundaries either.
          fail(err);
        }
      },
    }),
    [emit, engage, fail, liveRef, runner, store, tick],
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

  // A tick that threw is re-thrown HERE, during render, after every hook has
  // run (so React's hook order stays intact on the failing pass). Rendering is
  // the only phase error boundaries observe — the throw propagates from the
  // component calling this hook up to the nearest boundary, which
  // `InteractiveFigure` mounts immediately above it (FigureErrorBoundary).
  if (tickError) throw tickError;

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
