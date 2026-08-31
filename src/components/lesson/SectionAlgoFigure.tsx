"use client";

import { AlgoFigure } from "@/engine/algo/AlgoFigure";
import type { AlgoDef } from "@/engine/algo/types";
import type { ComponentType } from "react";
import { useSectionCompletion } from "./context";

interface SectionAlgoFigureProps<S, I> {
  def: AlgoDef<S, I>;
  /** The stage for this def's state — see `AlgoFigure`. */
  view: ComponentType<{ state: S }>;
  description: string;
  defaultSize?: number;
}

/** AlgoFigure wired into section completion — mirror of SectionFigure. */
export function SectionAlgoFigure<S, I>({
  def,
  view,
  description,
  defaultSize,
}: SectionAlgoFigureProps<S, I>) {
  const markComplete = useSectionCompletion();
  return (
    <AlgoFigure
      def={def}
      view={view}
      description={description}
      defaultSize={defaultSize}
      onEngage={markComplete}
    />
  );
}
