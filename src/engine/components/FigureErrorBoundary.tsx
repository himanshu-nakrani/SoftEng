"use client";

import { Component, Fragment, type ErrorInfo, type ReactNode } from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface FigureErrorBoundaryProps {
  children: ReactNode;
  /** Sim id — printed on the halted plate so a crash is attributable. */
  label?: string;
}

interface FigureErrorBoundaryState {
  error: Error | null;
  /**
   * Bumped by Restart. It keys `children`, so restarting does not merely clear
   * the fallback — it remounts the subtree, which rebuilds the runner from the
   * seed (`useSimulation` creates it in a ref on first render). Clearing the
   * error alone would re-render the same crashed sim straight back into the
   * same throw.
   */
  generation: number;
}

/**
 * Containment for one figure.
 *
 * Lesson `step` functions are ordinary authored code running 30 times a second
 * inside the engine's rAF loop; when one throws, React sees nothing and the
 * figure silently freezes (or, if the throw lands during a snapshot-driven
 * render, takes the whole lesson page down with it). `useSimulation` catches
 * tick failures and re-throws them during render precisely so this boundary
 * can turn them into a contained, restartable card — a broken figure must
 * cost the learner that figure and nothing else.
 *
 * Error boundaries must be class components; this is the codebase's only one.
 */
export class FigureErrorBoundary extends Component<
  FigureErrorBoundaryProps,
  FigureErrorBoundaryState
> {
  state: FigureErrorBoundaryState = { error: null, generation: 0 };

  static getDerivedStateFromError(
    error: Error,
  ): Partial<FigureErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Authoring aid: the sim id is the only thing that tells you *which*
    // figure died, and React's own log does not know about it.
    console.error(
      `[syslab] figure "${this.props.label ?? "unknown"}" crashed:`,
      error,
      info.componentStack,
    );
  }

  private handleRestart = () => {
    this.setState((prev) => ({
      error: null,
      generation: prev.generation + 1,
    }));
  };

  render() {
    const { error } = this.state;

    if (error) {
      return (
        <figure
          role="alert"
          className="my-6 overflow-hidden rounded-lg border border-glow-red/40 bg-surface"
        >
          <div className="relative flex flex-col items-start gap-3 bg-bg/40 px-5 py-6">
            <span className="tech-label flex items-center gap-2 text-glow-red">
              <TriangleAlert className="size-3.5" aria-hidden />
              sim crashed — {error.name}
            </span>

            <p className="max-w-prose font-mono text-xs leading-relaxed text-fg-muted">
              {error.message || "no message"}
            </p>

            <p className="max-w-prose text-sm text-fg-faint">
              This figure was halted so the rest of the lesson keeps running.
              Restarting replays it from the same seed.
            </p>

            <Button
              variant="outline"
              size="sm"
              onClick={this.handleRestart}
              className="mt-1"
            >
              <RotateCcw className="size-3.5" aria-hidden />
              Restart
            </Button>

            <span
              aria-hidden
              className="pointer-events-none absolute top-2.5 right-5 font-mono text-[9px] tracking-[0.12em] text-fg-muted uppercase"
            >
              fig · {this.props.label ?? "sim"} · halted
            </span>
          </div>
        </figure>
      );
    }

    return <Fragment key={this.state.generation}>{this.props.children}</Fragment>;
  }
}
