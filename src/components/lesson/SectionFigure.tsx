"use client";

import { InteractiveFigure } from "@/engine/components/InteractiveFigure";
import type { SimSnapshot } from "@/engine/snapshot";
import type { LessonSim } from "@/engine/types";
import type { ReactNode } from "react";
import { useSectionCompletion } from "./context";

interface SectionFigureProps<L> {
  sim: LessonSim<L>;
  description: string;
  autoplay?: boolean;
  seed?: number;
  stageOverlay?: (snapshot: SimSnapshot) => ReactNode;
}

/**
 * InteractiveFigure wired into the lesson's progress system: the section
 * completes on first meaningful interaction with the sim. Keeps the engine
 * layer free of any progress/curriculum dependency.
 */
export function SectionFigure<L>({
  sim,
  description,
  autoplay,
  seed,
  stageOverlay,
}: SectionFigureProps<L>) {
  const markComplete = useSectionCompletion();
  return (
    <InteractiveFigure
      sim={sim}
      description={description}
      autoplay={autoplay}
      seed={seed}
      stageOverlay={stageOverlay}
      onEngage={markComplete}
    />
  );
}
