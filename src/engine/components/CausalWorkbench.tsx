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
  focus,
  onStart,
}: ExperimentCardProps) {
  return (
    <section className="causal-experiment" aria-labelledby={`experiment-${experiment.id}`}>
      <div className="causal-experiment-copy">
        <span className="causal-kicker">
          <Sparkles className="size-3" aria-hidden />
          Guided experiment
        </span>
        <h3 id={`experiment-${experiment.id}`}>{experiment.title}</h3>
        <p>{experiment.prompt}</p>
        {focus?.summary && <p className="causal-experiment-claim">{focus.summary}</p>}
      </div>
      <button type="button" onClick={onStart} className="causal-action">
        <Play className="size-3.5" fill="currentColor" aria-hidden />
        {experiment.actionLabel}
        <ArrowRight className="size-3.5" aria-hidden />
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
      <div className="causal-tape-heading">
        <Route className="size-3.5" aria-hidden />
        <span>Event path</span>
      </div>
      <div className="causal-tape-list">
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
              <span className="causal-tape-dot" aria-hidden />
              <span className="causal-tape-meta">{phaseLabel[focus.phase]}</span>
              <span className="causal-tape-label">{focus.label}</span>
              {focus.at !== undefined && <span className="causal-tape-time">t={focus.at}s</span>}
            </button>
          );
        })}
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

function nodeState(runtime?: NodeRuntime) {
  if (!runtime) return "Awaiting a snapshot";
  if (runtime.ghost) return "Not provisioned";
  if (runtime.health === "dead") return "Failed";
  if (runtime.health === "degraded") return "Degraded";
  return "Healthy";
}

export function CausalInspector({
  focus,
  nodes,
  snapshotNodes,
  selectedNodeId,
  onSelectNode,
  onRestart,
}: CausalInspectorProps) {
  const selected = nodes.find((node) => node.id === selectedNodeId) ?? nodes[0];
  if (!selected) return null;
  const runtime = snapshotNodes[selected.id];
  const load = runtime ? `${Math.round(runtime.load * 100)}%` : "—";
  const queue = runtime?.queueDepth ?? 0;

  return (
    <aside className="causal-inspector" aria-labelledby="causal-inspector-title">
      <div className="causal-inspector-heading">
        <div>
          <span className="causal-kicker">
            <Eye className="size-3" aria-hidden />
            Inspect the system
          </span>
          <h3 id="causal-inspector-title">{focus?.label ?? "Current component"}</h3>
        </div>
        <button
          type="button"
          onClick={onRestart}
          className="causal-inspector-reset"
          title="Restart the deterministic scenario"
        >
          <RotateCcw className="size-3.5" aria-hidden />
          Restart
        </button>
      </div>

      <label className="causal-node-select-label">
        <span>Component</span>
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
        <div>
          <span>State</span>
          <strong>{nodeState(runtime)}</strong>
        </div>
        <div>
          <span>Load</span>
          <strong>{load}</strong>
        </div>
        <div>
          <span>Queue</span>
          <strong>{queue}</strong>
        </div>
      </div>

      <div className="causal-inspector-explanation">
        <Gauge className="size-3.5" aria-hidden />
        <p>{focus?.summary ?? `${selected.label} is part of the current system state.`}</p>
      </div>
      {focus?.nextAction && <p className="causal-next-action">Next: {focus.nextAction}</p>}
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
