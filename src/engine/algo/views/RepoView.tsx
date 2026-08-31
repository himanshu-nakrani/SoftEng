"use client";

import type { CommitFrame, RepoState } from "./repo";

const VIEW_W = 800;
const LANE_H = 56;
const TOP = 34;
const PAD_X = 28;
const COL_W = 62;
const R = 11;

const LANE_COLORS = [
  "var(--color-accent)",
  "var(--color-glow-cyan)",
  "var(--color-glow-violet)",
  "var(--color-glow-green)",
];

/**
 * The commit graph: commits left to right in creation order, one lane per
 * branch, branch pointers as tags.
 *
 * Rebased commits are drawn hollow with their original greyed out, because the
 * single most useful thing this view can say is "that is a COPY, and the commit
 * you had is now unreachable".
 */
export function RepoView({ state }: { state: RepoState }) {
  const { commits, branches, head, touched, unreachable } = state;
  const laneCount = Math.max(1, ...commits.map((c) => c.lane + 1));
  const height = TOP + laneCount * LANE_H + 30;
  const xOf = (c: CommitFrame) => PAD_X + (c.seq - 1) * COL_W;
  const yOf = (c: CommitFrame) => TOP + c.lane * LANE_H;
  const byId = new Map(commits.map((c) => [c.id, c]));
  const dead = new Set(unreachable);
  const hot = new Set(touched);

  /** Branch tips, grouped so several pointers on one commit stack. */
  const tips = new Map<string, string[]>();
  for (const [name, id] of Object.entries(branches)) {
    tips.set(id, [...(tips.get(id) ?? []), name]);
  }

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${height}`}
      className="block h-auto w-full"
      role="img"
      aria-label={ariaLabel(state)}
    >
      {/* parent edges first, so nodes sit on top */}
      {commits.map((commit) =>
        commit.parents.map((parentId) => {
          const parent = byId.get(parentId);
          if (!parent) return null;
          const faded = dead.has(commit.id) || dead.has(parentId);
          return (
            <path
              key={`${commit.id}-${parentId}`}
              d={edge(xOf(parent), yOf(parent), xOf(commit), yOf(commit))}
              fill="none"
              stroke={
                faded ? "var(--color-glow-red)" : LANE_COLORS[commit.lane % 4]
              }
              strokeWidth={1.5}
              strokeDasharray={faded ? "3 2" : undefined}
              opacity={faded ? 0.45 : 0.5}
            />
          );
        }),
      )}

      {commits.map((commit) => {
        const isDead = dead.has(commit.id);
        const isHot = hot.has(commit.id);
        const color = LANE_COLORS[commit.lane % 4];
        const isMerge = commit.parents.length > 1;
        return (
          <g key={commit.id} transform={`translate(${xOf(commit)}, ${yOf(commit)})`}>
            <circle
              r={R}
              fill={
                commit.rewriteOf
                  ? "var(--color-bg)"
                  : isDead
                    ? "var(--color-surface)"
                    : color
              }
              // An orphaned commit is LOST WORK, so it takes the wound hue and
              // stays legible. At border-grey and 0.5 opacity it was technically
              // drawn and effectively invisible — and "your commits are gone" is
              // the one thing the rebase figure exists to show, so whispering it
              // made the figure assert what it was supposed to demonstrate.
              // Dashed + red matches WalView's grammar for a lost log record.
              stroke={isDead ? "var(--color-glow-red)" : color}
              strokeWidth={commit.rewriteOf ? 2 : 1}
              strokeDasharray={isDead ? "3 2" : undefined}
              opacity={isDead ? 0.9 : 1}
              style={{
                transition: "fill 140ms, opacity 140ms",
                filter: isHot ? `drop-shadow(0 0 7px ${color})` : undefined,
              }}
            />
            {isMerge && (
              <circle r={4} fill="var(--color-bg)" opacity={isDead ? 0.5 : 1} />
            )}
            <text
              y={R + 13}
              textAnchor="middle"
              fill={isDead ? "var(--color-fg-faint)" : "var(--color-fg-muted)"}
              style={{ font: "500 9px var(--font-plex-mono)" }}
            >
              {commit.id}
            </text>

            {(tips.get(commit.id) ?? []).map((name, i) => (
              <g key={name} transform={`translate(${R + 6}, ${-R - 2 + i * 15})`}>
                <rect
                  width={Math.max(name.length * 6.2 + 12, 30)}
                  height={14}
                  rx={2}
                  fill={name === head ? "var(--color-accent-dim)" : "transparent"}
                  stroke={
                    name === head ? "var(--color-accent)" : "var(--color-border)"
                  }
                />
                <text
                  x={6}
                  y={10}
                  fill={
                    name === head
                      ? "var(--color-accent)"
                      : "var(--color-fg-faint)"
                  }
                  style={{ font: "500 9px var(--font-plex-mono)" }}
                >
                  {name === head ? `${name} ←` : name}
                </text>
              </g>
            ))}
          </g>
        );
      })}

      {unreachable.length > 0 && (
        <text
          x={PAD_X - 12}
          y={height - 8}
          fill="var(--color-fg-faint)"
          style={{ font: "500 10px var(--font-plex-mono)" }}
        >
          {unreachable.length} commit{unreachable.length === 1 ? "" : "s"} now
          unreachable ({unreachable.join(", ")})
        </text>
      )}
    </svg>
  );
}

/** Elbow from parent to child: straight within a lane, curved across lanes. */
function edge(x1: number, y1: number, x2: number, y2: number): string {
  if (y1 === y2) return `M ${x1} ${y1} L ${x2} ${y2}`;
  const mx = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
}

/** One sentence a screen reader can act on, rebuilt per frame. */
function ariaLabel(state: RepoState): string {
  const cmd = state.ranCommand ? `After ${state.ranCommand}: ` : "";
  const tips = Object.entries(state.branches)
    .map(([name, id]) => `${name} at ${id}`)
    .join(", ");
  const orphans =
    state.unreachable.length > 0
      ? ` ${state.unreachable.length} commits are unreachable.`
      : "";
  return `${cmd}${state.commits.length} commits. On ${state.head}. ${tips}.${orphans}`;
}
