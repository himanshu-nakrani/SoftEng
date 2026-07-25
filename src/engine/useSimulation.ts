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

/**
 * One line of the run's narration: a timeline caption that has actually been
 * shown, and the sim-time it appeared at.
 *
 * `at` is a real position on this run's clock, so it doubles as the row's seek
 * target — `seekTo(entry.at)` replays to the tick that fired the caption, which
 * is what makes the transcript a seekable index of the lesson's story rather
 * than a log.
 */
export interface CaptionEntry {
  /** Sim-seconds. Also the seek target for this line. */
  readonly at: number;
  readonly text: string;
}

export interface SimControls {
  /** `system: true` marks a non-user play (scroll autoplay) — never engages. */
  play: (opts?: { system?: boolean }) => void;
  pause: () => void;
  toggle: () => void;
  /** Advance exactly one logical tick while paused. */
  stepOnce: () => void;
  /** Re-run init with the same seed — deterministic replay. */
  restart: () => void;
  /**
   * Scrub to sim-time `t`: pause, replay from the seed, publish. See
   * `SimRunner.seekTo` for the semantics that matter (the replay runs under
   * the CURRENT params, and checkpoints crossed on the way are forfeited).
   *
   * This layer adds three rules of its own:
   * - **Pause first.** Playing is stopped *before* the replay, via the ref the
   *   rAF loop reads, so no banked tick can interleave with (or land after) the
   *   jump. Status stays "paused" afterwards — a scrub is a look, not a resume.
   * - **No-op during a quiz.** A fired checkpoint owns the transport; seeking
   *   out of it would skip the prediction the overlay is waiting on.
   * - **Not an engagement.** Unlike play/param/kill, seeking neither calls
   *   `onEngage` nor emits a `SimEvent`: scrubbing re-watches the system, it
   *   does not manipulate it, so it must not complete a section on its own.
   */
  seekTo: (t: number) => void;
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
  /**
   * High-water mark of `state.t` for this run — how far the learner has
   * actually seen, which is what a scrub track measures itself against.
   * Unchanged by a backwards seek (that is the whole point) and reset to 0 by
   * `restart`. Mirrored into React only when the whole second changes, so it
   * costs ~1 re-render/sec instead of one per tick and may trail the live
   * clock by up to a second — a scrub track's right edge, not a readout.
   */
  furthestT: number;
  /**
   * Every timeline caption this run has shown, oldest first — the history the
   * stage itself cannot keep (a caption is up for 4 sim-seconds and then gone).
   *
   * MUTATED IN PLACE, STABLE IDENTITY. The array object lives as long as the
   * hook does; appends push onto it and a rebuild empties and refills it.
   * `captionLogVersion` is the ONLY change signal — never `useMemo`/`useEffect`
   * on the array's identity, it will not change. (Copying the array per tick to
   * get identity semantics would allocate on the hot path for a panel almost
   * nobody has open; the version counter costs one integer.)
   */
  captionLog: readonly CaptionEntry[];
  /** Bumped on every change to `captionLog`. Depend on THIS, not the array. */
  captionLogVersion: number;
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

  // Furthest sim-time this run has reached. The authority is a ref (the rAF
  // loop must not re-render), mirrored into React state only when the whole
  // second changes — the number decides how far the scrub track extends, where
  // sub-second precision buys nothing and 30 re-renders/sec would cost the
  // whole figure subtree.
  const [furthestT, setFurthestT] = useState(0);
  const furthestRef = useRef(0);
  const mirroredFurthestRef = useRef(0);

  const [activeQuiz, setActiveQuiz] = useState<QuizCheckpoint<unknown> | null>(
    null,
  );
  const [quizAnswer, setQuizAnswer] = useState<string | null>(null);
  const engaged = useRef(false);
  const [tickError, setTickError] = useState<Error | null>(null);

  // ---- Caption transcript -------------------------------------------------
  // The runner reports the caption that is visible after each tick; a *new*
  // one is a change in that value, which is all the history anyone keeps.
  const captionLogRef = useRef<CaptionEntry[]>([]);
  const lastCaptionRef = useRef<string | null>(null);
  const [captionLogVersion, setCaptionLogVersion] = useState(0);

  /**
   * The lesson's ungated captioned beats, ascending — the only part of the
   * narration that can be RECONSTRUCTED at an arbitrary sim-time (see
   * `rebuildCaptionLog`). Captured once, like the runner itself: both are built
   * from the first `sim` and a lesson object is a module constant.
   */
  const scheduleRef = useRef<CaptionEntry[] | null>(null);
  if (scheduleRef.current === null) {
    scheduleRef.current = (sim.timeline ?? [])
      .filter((ev) => ev.caption !== undefined && ev.when === undefined)
      .map((ev) => ({ at: ev.at, text: ev.caption! }))
      .sort((a, b) => a.at - b.at);
  }

  /**
   * Record the caption a tick left standing, if it is a new one.
   *
   * Detection is by value change, since that is what the runner exposes: a
   * caption that expires reads back as null, so the next one is always a
   * change. The one blind spot is two beats with byte-identical text whose
   * windows overlap — the second is not a new *value*, so it does not get a
   * line. Lessons write distinct captions, and a duplicate line would be worse
   * than a missing one for something used as an index.
   */
  const noteCaption = useCallback((caption: string | null, at: number) => {
    if (caption === lastCaptionRef.current) return;
    lastCaptionRef.current = caption;
    if (caption === null) return; // expiry, not a new line
    captionLogRef.current.push({ at, text: caption });
    setCaptionLogVersion((v) => v + 1);
  }, []);

  /** Empty the log and resync the change detector (restart's verb). */
  const clearCaptionLog = useCallback(() => {
    captionLogRef.current.length = 0;
    lastCaptionRef.current = null;
    setCaptionLogVersion((v) => v + 1);
  }, []);

  /**
   * Re-derive the log after a seek.
   *
   * A seek is a replay from tick zero, and the replay re-fires every beat on
   * the way — so the log MUST NOT simply keep accumulating (every scrub would
   * duplicate the whole story) and MUST NOT simply be cleared (scrubbing to
   * t=20 would claim nothing had ever been narrated). It is rebuilt instead.
   *
   * `SimRunner.seekTo` discards the replay's `TickResult`s (that is the quiz-
   * forfeit rule), so the hook cannot observe those firings — it reconstructs
   * from what IS knowable without state: the lesson's ungated captioned beats
   * with `at <= t`, which fire on the clock alone and therefore provably fired
   * during the replay.
   *
   * LIMITATION, deliberate and honest: a GATED beat (`when`) fires only if its
   * condition held at that moment of the replay, which is a fact about a world
   * that no longer exists. Those lines are dropped from the log by a seek and
   * come back only when live playback crosses the beat again. Guessing would
   * mean printing a stamped line for narration the learner may never have seen.
   *
   * `caption` is the runner's post-seek caption, adopted as the detector's
   * baseline so the first tick after the seek — which still reports that same
   * caption — does not append it a second time.
   */
  const rebuildCaptionLog = useCallback(
    (t: number, caption: string | null) => {
      const log = captionLogRef.current;
      log.length = 0;
      for (const beat of scheduleRef.current ?? []) {
        if (beat.at <= t) log.push(beat);
      }
      lastCaptionRef.current = caption;
      setCaptionLogVersion((v) => v + 1);
    },
    [],
  );

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

  /**
   * Raise the high-water mark and decide whether React needs to hear about it.
   * `flush` forces the mirror (discrete jumps — seek, restart — should land
   * immediately rather than waiting for the next whole second).
   */
  const markProgress = useCallback((t: number, flush = false) => {
    if (t > furthestRef.current) furthestRef.current = t;
    const next = furthestRef.current;
    if (flush || Math.floor(next) !== Math.floor(mirroredFurthestRef.current)) {
      mirroredFurthestRef.current = next;
      setFurthestT(next);
    }
  }, []);

  /**
   * Back to zero. Separate from `markProgress`, which only ever raises the
   * mark — a restart is the one thing that legitimately un-sees a run, and
   * folding "lower it" into the tick path would be a footgun for the seek that
   * must NOT lower it.
   */
  const resetProgress = useCallback(() => {
    furthestRef.current = 0;
    mirroredFurthestRef.current = 0;
    setFurthestT(0);
  }, []);

  /** One logical tick, plus this layer's policy: a crossed quiz hard-pauses. */
  const tick = useCallback(() => {
    const { firedQuiz, caption } = runner.tick();
    markProgress(runner.state.t);
    // Stamp the line with the clock of the tick that raised it — which is the
    // first tick at or after the beat's `at`, and therefore a time you can seek
    // back to and see the caption again.
    noteCaption(caption, runner.state.t);
    if (firedQuiz) {
      setActiveQuiz(firedQuiz);
      setQuizAnswer(null);
      setStatus("quiz");
      // The accumulator loop reads statusRef, which otherwise only catches
      // up on the next render — without this the sim overshoots `at` by
      // however many ticks are still banked (up to ~11 at 2x).
      statusRef.current = "quiz";
    }
  }, [markProgress, noteCaption, runner]);

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
        resetProgress();
        // The run being un-seen includes its narration: a restarted figure has
        // told the learner nothing yet.
        clearCaptionLog();
        store.publish(null);
      },
      seekTo: (t) => {
        // A fired checkpoint owns the transport (see the doc on SimControls).
        if (statusRef.current === "quiz") return;
        // Stop the loop through the ref it actually reads, BEFORE the replay:
        // a `setStatus` alone lands a render later, which is long enough for
        // the next frame to spend its banked time on the world we are about to
        // throw away (and to land ticks *after* the jump).
        statusRef.current = "paused";
        setStatus("paused");
        try {
          runner.seekTo(t);
        } catch (err) {
          // Replay runs the lesson's `step` thousands of times outside the rAF
          // loop's try — same policy: first throw wins and reaches the boundary
          // through the render pass.
          fail(err);
          return;
        }
        // seekTo replaces the state object, exactly as restart does.
        liveRef.current = runner.state;
        markProgress(runner.state.t, true);
        // The replay re-fired every beat it passed; rebuild rather than let
        // the log double (see `rebuildCaptionLog` for what survives a seek).
        rebuildCaptionLog(runner.state.t, runner.caption);
        store.publish(runner.caption);
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
    [
      clearCaptionLog,
      emit,
      engage,
      fail,
      liveRef,
      markProgress,
      rebuildCaptionLog,
      resetProgress,
      runner,
      store,
      tick,
    ],
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
    furthestT,
    captionLog: captionLogRef.current,
    captionLogVersion,
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
