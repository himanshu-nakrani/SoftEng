"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { mulberry32 } from "../rng";
import type { AlgoDef, AlgoStep } from "./types";

export interface AlgoControls {
  toggle: () => void;
  play: () => void;
  pause: () => void;
  stepForward: () => void;
  stepBack: () => void;
  restart: () => void;
  scrub: (index: number) => void;
  setSpeed: (multiplier: number) => void;
}

export interface AlgoPlayer {
  steps: AlgoStep[];
  index: number;
  current: AlgoStep;
  playing: boolean;
  speed: number;
  atEnd: boolean;
  controls: AlgoControls;
}

const BASE_STEPS_PER_SEC = 4;

/**
 * Index-based playback over a precomputed step list. Stepping back is just
 * index-1 — the luxury the packet sim can never afford.
 */
export function useAlgoPlayer(
  def: AlgoDef,
  n: number,
  seed: number,
  onEngage?: () => void,
): AlgoPlayer {
  const steps = useMemo(() => {
    const input = def.generateInput(mulberry32(seed), n);
    return def.run(input);
  }, [def, n, seed]);

  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const engaged = useRef(false);
  const onEngageRef = useRef(onEngage);
  onEngageRef.current = onEngage;

  const engage = () => {
    if (!engaged.current) {
      engaged.current = true;
      onEngageRef.current?.();
    }
  };

  // Reset playback when the step list changes (new n / seed / algorithm).
  useEffect(() => {
    setIndex(0);
    setPlaying(false);
  }, [steps]);

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
      toggle: () => {
        engage();
        setPlaying((p) => (index >= steps.length - 1 && !p ? p : !p));
        if (index >= steps.length - 1) {
          setIndex(0);
          setPlaying(true);
        }
      },
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
