"use client";

import { cn } from "@/lib/cn";
import {
  ArrowRight,
  CircleDotDashed,
  Eye,
  Gauge,
  Play,
  RotateCcw,
  Route,
  Sparkles,
} from "lucide-react";
import type { NodeRuntime, NodeSpec, WorkbenchExperiment, WorkbenchFocus } from "../types";

interface ExperimentCardProps {
  experiment: WorkbenchExperiment;
  focus?: WorkbenchFocus;
  onStart: () => void;
}

export function ExperimentCard({
  experiment,
  onStart,
}: ExperimentCardProps) {
  return (
    <section className="causal-experiment" aria-labelledby={`experiment-${experiment.id}`}>
      <div className="causal-experiment-copy">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="causal-kicker">
            <span className="flex size-4 items-center justify-center rounded-full bg-accent-dim">
              <Sparkles className="size-2.5 text-accent" aria-hidden />
            </span>
            Guided experiment
          </span>
          <span className="hidden text-border-bright sm:inline" aria-hidden>·</span>
          <h3 id={`experiment-${experiment.id}`}>{experiment.title}</h3>
        </div>
        <p>{experiment.prompt}</p>
      </div>
      <button type="button" onClick={onStart} className="causal-action group">
        <Play className="size-3 transition-transform duration-150 group-hover:scale-110" fill="currentColor" aria-hidden />
        {experiment.actionLabel}
        <ArrowRight className="size-3 transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden />
      </button>
    </section>
  );
}

interface EventTapeProps {
  focuses: readonly WorkbenchFocus[];
  activeId?: string;
  onSelect: (focus: WorkbenchFocus) => void;
}

const phaseLabel: Record<WorkbenchFocus["phase"], string> = {
  baseline: "Baseline",
  change: "Change",
  impact: "Impact",
  resolution: "Resolution",
};

export function CausalEventTape({ focuses, activeId, onSelect }: EventTapeProps) {
  if (focuses.length === 0) return null;
  return (
    <section className="causal-tape" aria-label="Causal event landmarks">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <div className="causal-tape-heading shrink-0 mb-0">
          <span className="flex size-4 items-center justify-center rounded-full border border-border bg-surface shadow-xs">
            <Route className="size-2.5 text-fg-muted" aria-hidden />
          </span>
          <span>Event path</span>
        </div>
        <div className="causal-tape-list flex-1 min-w-0">
          {focuses.map((focus) => {
          const active = focus.id === activeId;
          return (
            <button
              key={focus.id}
              type="button"
              onClick={() => onSelect(focus)}
              aria-pressed={active}
              className={cn("causal-tape-event", active && "is-active")}
            >
              <div className="flex w-full items-center justify-between gap-1">
                <span className="causal-tape-meta">{phaseLabel[focus.phase]}</span>
                {focus.at !== undefined && <span className="causal-tape-time">t={focus.at}s</span>}
              </div>
              <span className="causal-tape-label">{focus.label}</span>
            </button>
          );
        })}
        </div>
      </div>
    </section>
  );
}

interface CausalInspectorProps {
  focus?: WorkbenchFocus;
  nodes: readonly NodeSpec[];
  snapshotNodes: Record<string, NodeRuntime>;
  selectedNodeId?: string;
  onSelectNode: (nodeId: string) => void;
  onRestart: () => void;
}

function nodeState(runtime?: NodeRuntime): { label: string; dot: string } {
  if (!runtime) return { label: "Awaiting snapshot", dot: "bg-fg-faint" };
  if (runtime.ghost) return { label: "Not provisioned", dot: "bg-fg-faint" };
  if (runtime.health === "dead") return { label: "Failed", dot: "bg-glow-red" };
  if (runtime.health === "degraded") return { label: "Degraded", dot: "bg-glow-orange" };
  return { label: "Healthy", dot: "bg-glow-green" };
}

export function CausalInspector({
  focus,
  nodes,
  snapshotNodes,
  selectedNodeId,
  onSelectNode,
}: CausalInspectorProps) {
  const selected = nodes.find((node) => node.id === selectedNodeId) ?? nodes[0];
  if (!selected) return null;
  const runtime = snapshotNodes[selected.id];
  const load = runtime ? `${Math.round(runtime.load * 100)}%` : "—";
  const queue = runtime?.queueDepth ?? 0;
  const state = nodeState(runtime);

  return (
    <aside className="causal-inspector" aria-labelledby="causal-inspector-title">
      <div className="causal-inspector-heading">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="causal-kicker">
            <Eye className="size-3" aria-hidden />
            Inspect
          </span>
          <h3 id="causal-inspector-title">{focus?.label ?? "Current component"}</h3>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="causal-node-select-label flex items-center gap-1.5">
            <span className="sr-only sm:not-sr-only">Component:</span>
            <select
              value={selected.id}
              onChange={(event) => onSelectNode(event.target.value)}
              className="causal-node-select"
            >
              {nodes.map((node) => (
                <option key={node.id} value={node.id}>
                  {node.label} · {node.kind}
                </option>
              ))}
            </select>
          </label>

          <div className="causal-inspector-state" aria-live="polite">
            <div title="Component status">
              <span className={cn("size-1.5 shrink-0 rounded-full", state.dot)} />
              <strong>{state.label}</strong>
            </div>
            <div title="Load">
              <span>Load</span>
              <strong>{load}</strong>
            </div>
            <div title="Queue depth">
              <span>Queue</span>
              <strong>{queue}</strong>
            </div>
          </div>
        </div>
      </div>

      <div className="causal-inspector-explanation">
        <div className="flex size-4.5 shrink-0 items-center justify-center rounded border border-accent/25 bg-accent-dim/60 shadow-xs">
          <Gauge className="size-2.5 text-accent" aria-hidden />
        </div>
        <p className="flex-1">
          {focus?.summary ?? `${selected.label} is part of the current system state.`}
          {focus?.nextAction && (
            <span className="causal-next-action ml-1.5 inline-block">
              Next: {focus.nextAction}
            </span>
          )}
        </p>
      </div>
    </aside>
  );
}


interface StaticViewToggleProps {
  active: boolean;
  onToggle: () => void;
}

export function StaticViewToggle({ active, onToggle }: StaticViewToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      className={cn("causal-static-toggle", active && "is-active")}
      title="Show traffic and state without moving packets"
    >
      <CircleDotDashed className="size-3.5" aria-hidden />
      {active ? "Live motion" : "Static state"}
    </button>
  );
}
