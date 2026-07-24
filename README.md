# syslab

**Learn systems by breaking them.**

An interactive system-design learning site. Not articles — every concept is a running simulation: request packets you can watch, parameters you can drag, servers you can kill. Predict what a system will do, then watch the deterministic simulation prove you right or wrong.

## Track 01 — System Design Fundamentals

| Module | Lessons |
|---|---|
| **Scaling** | Client & Server · Vertical vs Horizontal Scaling · Load Balancing |
| **Data at Scale** | Caching · Database Replication · Sharding · Consistent Hashing |
| **Distributed Systems** | Rate Limiting · Message Queues & Backpressure · The CAP Theorem |

Each lesson follows the same arc: **observe** (narrated autoplay) → **manipulate** (live sliders) → **predict** (the sim pauses, asks, then resumes to prove the answer) → **break** (click servers to kill them).

## Running

```bash
npm install
npm run dev        # develop on localhost:3000
npm run check      # typecheck + lint + curriculum/route sync check
npm run build      # static export to out/ — deploy to any static host
```

No backend, no accounts. Progress lives in your browser's localStorage.

## How it works

- **Simulation engine** (`src/engine/`): hand-rolled SVG. A fixed-timestep (30 tps) loop drives a pure-ish `step(state, dt, params)` reducer per lesson; a pooled set of 128 packet dots is animated imperatively inside a single `requestAnimationFrame` — React never re-renders per frame. Seeded randomness (mulberry32) makes every run deterministic: restart replays the exact same traffic.
- **Lessons are data** (`src/lessons/`): topology + params + step function + scripted timeline + prediction quizzes (~200 lines each).
- **Curriculum registry** (`src/curriculum/registry.ts`): single source of truth for the sidebar, lesson map, progress math, and navigation, enforced against route folders by CI.

Built with Next.js 15, React 19, Tailwind CSS v4, Motion, and zustand.
