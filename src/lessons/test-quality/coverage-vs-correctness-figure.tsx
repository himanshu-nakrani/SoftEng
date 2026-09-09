"use client";

import { SectionAlgoFigure } from "@/components/lesson/SectionAlgoFigure";
import { MutationView } from "@/engine/algo/views/MutationView";
import {
  coverageVsCorrectnessAlgo,
  coverageVsCorrectnessStrengthenedAlgo,
} from "./coverage-vs-correctness";

/**
 * The RSC boundary: an AlgoDef carries functions, so the server page imports
 * these wrappers rather than the defs. This is also the only file allowed to
 * name the view COMPONENT.
 */
export function WeakAssertionsFigure() {
  return (
    <SectionAlgoFigure
      def={coverageVsCorrectnessAlgo}
      view={MutationView}
      description="A grading function under a suite that runs every line but only checks that a letter came back. One row per mutant, one column per test; a red row is a change no test noticed. All six mutants survive."
    />
  );
}

export function StrengthenedFigure() {
  return (
    <SectionAlgoFigure
      def={coverageVsCorrectnessStrengthenedAlgo}
      view={MutationView}
      description="The same grading function and the same six mutants, now under tests that assert the exact grade for the same inputs. Identical line coverage, but every row turns green — all six mutants are killed."
    />
  );
}
