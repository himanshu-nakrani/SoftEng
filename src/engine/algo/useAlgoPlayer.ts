"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { buildAlgoSteps } from "./build";
import type { AlgoDef, AlgoStep } from "./types";

export interface AlgoControls {
  play: () => void;
  pause: () => void;
  stepForward: () => void;
  stepBack: () => void;
  restart: () => void;
  scrub: (index: number) => void;
  setSpeed: (multiplier: number) => void;
}

export interface AlgoPlayer<S> {
  steps: AlgoStep<S>[];
  index: number;
  current: AlgoStep<S>;
  playing: boolean;
  speed: number;
  atEnd: boolean;
  controls: AlgoControls;
}

const BASE_STEPS_PER_SEC = 4;

/**
 * Index-based playback over a precomputed step list. Stepping back is just
 * index-1 — the luxury the packet sim can never afford.
 *
 * Generic in the step state so the hook is as view-agnostic as the step list
 * it walks; it never reads `step.state`.
 */
export function useAlgoPlayer<S, I>(
  def: AlgoDef<S, I>,
  size: number,
  seed: number,
  onEngage?: () => void,
): AlgoPlayer<S> {
  const steps = useMemo(
    () => buildAlgoSteps(def, size, seed),
    [def, size, seed],
  );

  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const engaged = useRef(false);
  const onEngageRef = useRef(onEngage);
  useEffect(() => {
    onEngageRef.current = onEngage;
  }, [onEngage]);

  const engage = () => {
    if (!engaged.current) {
      engaged.current = true;
      onEngageRef.current?.();
    }
  };

  // Reset playback when the step list changes (new size / seed / algorithm).
  // Render-phase state adjustment (react.dev "Adjusting state when a prop
  // changes"): comparing against the stored previous list lets React discard
  // the render instead of cascading a second commit through an effect.
  const [prevSteps, setPrevSteps] = useState(steps);
  if (prevSteps !== steps) {
    setPrevSteps(steps);
    setIndex(0);
    setPlaying(false);
  }

  // Playback interval.
  useEffect(() => {
    if (!playing) return;
    const interval = setInterval(
      () => {
        setIndex((i) => {
          if (i >= steps.length - 1) {
            setPlaying(false);
            return i;
          }
          return i + 1;
        });
      },
      1000 / (BASE_STEPS_PER_SEC * speed),
    );
    return () => clearInterval(interval);
  }, [playing, speed, steps.length]);

  const clamp = (i: number) => Math.max(0, Math.min(i, steps.length - 1));

  return {
    steps,
    index,
    current: steps[clamp(index)],
    playing,
    speed,
    atEnd: index >= steps.length - 1,
    controls: {
      play: () => {
        engage();
        setPlaying(true);
      },
      pause: () => setPlaying(false),
      stepForward: () => {
        engage();
        setPlaying(false);
        setIndex((i) => clamp(i + 1));
      },
      stepBack: () => {
        engage();
        setPlaying(false);
        setIndex((i) => clamp(i - 1));
      },
      restart: () => {
        setPlaying(false);
        setIndex(0);
      },
      scrub: (i) => {
        engage();
        setPlaying(false);
        setIndex(clamp(i));
      },
      setSpeed,
    },
  };
}
