"use client";

import { AlgoFigure } from "@/engine/algo/AlgoFigure";
import type { AlgoDef } from "@/engine/algo/types";
import { useSectionCompletion } from "./context";

interface SectionAlgoFigureProps {
  def: AlgoDef;
  description: string;
  defaultN?: number;
}

/** AlgoFigure wired into section completion — mirror of SectionFigure. */
export function SectionAlgoFigure({
  def,
  description,
  defaultN,
}: SectionAlgoFigureProps) {
  const markComplete = useSectionCompletion();
  return (
    <AlgoFigure
      def={def}
      description={description}
      defaultN={defaultN}
      onEngage={markComplete}
    />
  );
}
