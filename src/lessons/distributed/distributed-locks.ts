import {
  advancePackets,
  approach,
  clamp01,
  isAlive,
  spawnPacket,
} from "@/engine/sim-helpers";
import type { LessonSim, SimState } from "@/engine/types";

/**
 * Distributed Locks & Clock Skew — archetype A (the packet engine).
 *
 * A lock that spans machines cannot be a mutex: the lock service cannot tell a
 * crashed holder from a slow one, so it hands out a LEASE that expires on its
 * own. That is the whole vulnerability. A holder that is merely PAUSED — a long
 * GC pause, a descheduled VM — can wake up past its own lease still believing
 * it holds the lock, while a second worker has legitimately acquired it. Now
 * two workers write to the shared store, which is exactly what the lock existed
 * to prevent.
 *
 * FENCING is the fix modelled here: each grant carries a monotonically
 * increasing token, the store remembers the highest token it has accepted, and
 * it REJECTS (a policy refusal, not a capacity drop) any write carrying an
 * older one. The stale holder's write is refused at the resource, so
 * correctness stops depending on timing.
 *
 * Model:
 *   worker-a, worker-b  →  lock service  →  shared store
 *   Each worker, when it holds a live lease, writes to the store at a steady
 *   pace. A scripted beat pauses A past its lease; B acquires (token 2); A
 *   wakes and writes with its stale token 1. Fencing off ⇒ that write lands and
 *   the store records two writers (corruption). Fencing on ⇒ the store rejects
 *   it.
 *
 * LIMITS — this is a believable model, not a faithful lock service. There is
 * no network loss, no clock drift between machines (skew is discussed in prose,
 * not simulated as divergent clocks), no lease renewal/heartbeat, and no
 * contention beyond the two scripted workers. The lease timer runs on the
 * SIM clock, so "expiry" here is exact where the lesson's whole point is that
 * on real machines it is not. Writes are abstract tokens, not row data, and the
 * store's "corruption" is a counter of accepted stale writes rather than a
 * modelled inconsistency. Token comparison and lease expiry are the only
 * mechanics; everything else is stripped away so the failure is legible.
 */

const WORKERS = ["worker-a", "worker-b"] as const;
type WorkerId = (typeof WORKERS)[number];

/** Packet progress/sec on the short lock/store hops (~0.5s each way). */
const HOP_SPEED = 2;

/** How often a lease-holding worker fires a write at the store. */
const WRITE_INTERVAL = 0.9;

/** A holder renews once its lease is within this many seconds of expiring. */
const RENEW_MARGIN = 1.5;

/** How often a worker WITHOUT the lock polls to try to acquire it. */
const POLL_INTERVAL = 0.8;

/** The scripted pause is one lease plus this margin, so A always over-runs. */
const PAUSE_MARGIN = 2.5;

interface Worker {
  /** The lease this worker currently believes it holds, or null. */
  hasLease: boolean;
  /** The fencing token it was granted with that lease (0 = none). */
  token: number;
  /** Sim-seconds this worker's lease expires (from ITS point of view). */
  leaseUntil: number;
  /** Sim-seconds banked toward the next write. */
  writeAcc: number;
  /** Sim-seconds banked toward the next acquire poll (non-holders). */
  pollAcc: number;
  /** Sim-seconds this worker is frozen until (a GC pause / deschedule). */
  pausedUntil: number;
  /** A grant is in flight to this worker — don't request again meanwhile. */
  requesting: boolean;
}

interface DistributedLocksState {
  workers: Record<WorkerId, Worker>;
  /** The lock service's view: who holds it, and the token it last issued. */
  heldBy: WorkerId | null;
  lockExpiresAt: number;
  nextToken: number;
  /** The store's high-water mark — the largest token it has accepted. */
  storeToken: number;
  /** Writes the store accepted in good order. */
  goodWrites: number;
  /** Stale-token writes the store REJECTED (fencing on). */
  rejectedWrites: number;
  /** Stale-token writes that LANDED because fencing was off — corruption. */
  corruptWrites: number;
  /** Live load smoothing for the store node. */
  storeGlow: number;
  /** Latches once the reader has manually paused A — mutes the invitation. */
  readerPausedA: boolean;
  /** The lease slider's current value, mirrored so the timeline can read it. */
  curLease: number;
}

function worker(): Worker {
  return {
    hasLease: false,
    token: 0,
    leaseUntil: 0,
    writeAcc: 0,
    pollAcc: 0,
    pausedUntil: 0,
    requesting: false,
  };
}

const workerEdge = (id: WorkerId) => `${id}-lock`;
const storeEdge = (id: WorkerId) => `${id}-store`;

/** Freeze a worker for `d` sim-seconds — the GC pause / VM deschedule. */
function pause(state: SimState<DistributedLocksState>, id: WorkerId, d: number): void {
  state.lesson.workers[id].pausedUntil = state.t + d;
}

export const distributedLocksSim: LessonSim<DistributedLocksState> = {
  id: "distributed-locks",

  topology: {
    nodes: [
      { id: "worker-a", kind: "server", label: "worker-a", x: 150, y: 120, breakable: true },
      { id: "worker-b", kind: "server", label: "worker-b", x: 150, y: 330 },
      { id: "lock", kind: "loadbalancer", label: "lock svc", x: 430, y: 225 },
      { id: "store", kind: "database", label: "store", x: 680, y: 225 },
    ],
    edges: [
      { id: "worker-a-lock", from: "worker-a", to: "lock", curve: -0.18 },
      { id: "worker-b-lock", from: "worker-b", to: "lock", curve: 0.18 },
      { id: "worker-a-store", from: "worker-a", to: "store", curve: -0.32 },
      { id: "worker-b-store", from: "worker-b", to: "store", curve: 0.32 },
    ],
  },

  packetStyles: {
    // Requesting/holding the lock — the control plane, demoted cyan.
    acquire: { color: "var(--color-glow-cyan)", size: 3 },
    grant: { color: "var(--color-glow-violet)", size: 3.5 },
    // A write the store accepted in order — the good path.
    write: { color: "var(--color-glow-green)", size: 4 },
    // A stale-token write that LANDED (fencing off): corruption, red.
    "stale-write": { color: "var(--color-glow-red)", size: 4.5 },
    // A stale-token write the store REFUSED (fencing on): a policy refusal,
    // grey — red stays reserved for the write that should never have landed.
    rejected: { color: "var(--color-fg-faint)", size: 3.5 },
  },

  packetLegend: [
    { type: "acquire", label: "acquire lease" },
    { type: "grant", label: "granted (with token)" },
    { type: "write", label: "write accepted" },
    { type: "stale-write", label: "stale write LANDED (corruption)" },
    { type: "rejected", label: "stale write rejected (fenced)" },
  ],

  initialNodes: {
    store: { meta: { token: 0, writers: 0 } },
  },

  params: [
    {
      key: "lease",
      label: "lease duration",
      kind: "slider",
      min: 2,
      max: 8,
      step: 0.5,
      unit: "s",
      defaultValue: 4,
    },
    {
      key: "fencing",
      label: "fencing tokens",
      kind: "toggle",
      defaultValue: false,
    },
    {
      key: "pauseA",
      label: "pause worker-a",
      kind: "button",
      defaultValue: false,
    },
  ],

  init: () => ({
    workers: {
      "worker-a": worker(),
      "worker-b": worker(),
    } as Record<WorkerId, Worker>,
    heldBy: null,
    lockExpiresAt: 0,
    nextToken: 0,
    storeToken: 0,
    goodWrites: 0,
    rejectedWrites: 0,
    corruptWrites: 0,
    storeGlow: 0,
    readerPausedA: false,
    curLease: 4,
  }),

  step: (state, dt, params) => {
    const L = state.lesson;
    const lease = Number(params.lease);
    const fencing = params.fencing === true;
    L.curLease = lease; // let the timeline's scripted pause honour the slider

    // 0. The pause button — freeze worker-a for one lease + margin.
    if (params.pauseA === true) {
      params.pauseA = false; // consume the press
      L.readerPausedA = true;
      pause(state, "worker-a", lease + PAUSE_MARGIN);
    }

    // 1. The lock service expires its own lease. Once the lease is up the lock
    //    is free to grant again — the service cannot tell whether the old
    //    holder crashed or is merely slow, so it reclaims on the timer alone.
    if (L.heldBy && state.t >= L.lockExpiresAt) {
      L.heldBy = null;
    }

    // 2. Each worker's own loop: acquire when it can, write while it holds.
    for (const id of WORKERS) {
      const w = L.workers[id];
      const node = state.nodes[id];

      // A CRASHED worker (the reader clicked it dead) is the case a lease
      // handles cleanly: it stops everything and gives up its belief, so the
      // service's expiry hands the lock to a live worker with no second writer
      // ever appearing. Contrast this with a PAUSE below — that is the one the
      // lease cannot save you from.
      if (!isAlive(state, id)) {
        w.hasLease = false;
        w.requesting = false;
        node.load = 0;
        continue;
      }

      const paused = state.t < w.pausedUntil;
      // A paused worker does nothing at all — not even notice its lease lapse.
      if (paused) {
        node.load = approach(node.load, 0.15, 6, dt);
        continue;
      }

      w.pollAcc += dt;
      if (w.hasLease) {
        // A holder RENEWS before its lease runs out — the normal way a lock is
        // kept. This is exactly what a paused worker fails to do: frozen, it
        // never sends the renewal, so its lease lapses without it noticing. A
        // renewal that gets no answer (the lock is already gone) is retried on
        // the same poll interval rather than every tick.
        if (
          !w.requesting &&
          state.t > w.leaseUntil - RENEW_MARGIN &&
          w.pollAcc >= POLL_INTERVAL
        ) {
          w.pollAcc = 0;
          w.requesting = true;
          spawnPacket(state, workerEdge(id), "acquire", {
            speed: HOP_SPEED,
            payload: { from: id },
          });
        }
      } else if (!w.requesting && w.pollAcc >= POLL_INTERVAL) {
        // A worker without the lock polls for it on an interval. The service
        // grants only if the lock is actually free, so most polls get nothing.
        w.pollAcc = 0;
        w.requesting = true;
        spawnPacket(state, workerEdge(id), "acquire", {
          speed: HOP_SPEED,
          payload: { from: id },
        });
      }

      // Write to the store on our own drumbeat while we believe we hold it.
      // Crucially, the worker trusts its OWN sense of the lease — which after a
      // pause is stale — so it keeps writing past the real expiry.
      if (w.hasLease) {
        w.writeAcc += dt;
        if (w.writeAcc >= WRITE_INTERVAL) {
          w.writeAcc -= WRITE_INTERVAL;
          spawnPacket(state, storeEdge(id), "write", {
            speed: HOP_SPEED,
            payload: { from: id, token: w.token },
          });
        }
      }

      node.load = approach(node.load, w.hasLease ? 0.7 : 0.25, 6, dt);
    }

    // 3. Deliveries.
    let storeActivity = 0;
    for (const p of advancePackets(state, dt)) {
      const from = p.payload?.from as WorkerId | undefined;

      if (p.type === "acquire" && from) {
        const w = L.workers[from];
        w.requesting = false;
        if (L.heldBy === from) {
          // A renewal from the current holder: extend the lease, keep the same
          // token. The token only ever advances on a NEW grant.
          L.lockExpiresAt = state.t + lease;
          spawnPacket(state, workerEdge(from), "grant", {
            speed: HOP_SPEED,
            reverse: true,
            payload: { from, token: L.nextToken, until: L.lockExpiresAt },
          });
        } else if (!L.heldBy) {
          // The lock is free: hand it to this requester with a FRESH, higher
          // token. This is the moment a stale holder is about to be created —
          // if the old holder is only paused, it still thinks it holds token
          // one-less.
          L.heldBy = from;
          L.nextToken += 1;
          L.lockExpiresAt = state.t + lease;
          spawnPacket(state, workerEdge(from), "grant", {
            speed: HOP_SPEED,
            reverse: true,
            payload: { from, token: L.nextToken, until: L.lockExpiresAt },
          });
        }
        // Otherwise a live holder blocks: the requester gets nothing back and
        // will poll again later.
        continue;
      }

      if (p.type === "grant" && from) {
        const w = L.workers[from];
        w.hasLease = true;
        w.token = Number(p.payload?.token ?? 0);
        // The worker records the expiry it was told — the number it will keep
        // trusting even if it is later frozen past it.
        w.leaseUntil = Number(p.payload?.until ?? 0);
        w.writeAcc = 0;
        continue;
      }

      if (p.type === "write" && from) {
        const token = Number(p.payload?.token ?? 0);
        storeActivity += 1;
        // The store's rule. With fencing it compares the token against its
        // high-water mark and REJECTS anything older (a policy refusal). A
        // worker whose lease the service already reclaimed and re-granted is
        // carrying a stale token, so this is exactly the second-writer write.
        const stale = token < L.storeToken;
        if (fencing && stale) {
          L.rejectedWrites += 1;
          // A policy refusal, fired back down the edge as our grey "rejected"
          // kind — NOT a capacity drop. The store simply will not accept a
          // token below its high-water mark.
          spawnPacket(state, storeEdge(from), "rejected", {
            speed: HOP_SPEED * 1.3,
            reverse: true,
            size: 3.5,
          });
          continue;
        }
        if (stale) {
          // Fencing off: the stale write LANDS. Two workers have now written —
          // the corruption the lock was supposed to prevent.
          L.corruptWrites += 1;
          spawnPacket(state, storeEdge(from), "stale-write", {
            speed: HOP_SPEED * 1.3,
            reverse: true,
          });
        } else {
          L.goodWrites += 1;
          // A fresh write advances the store's high-water mark.
          L.storeToken = Math.max(L.storeToken, token);
        }
        continue;
      }
      // grants that found no lock, and faded bounces, just complete.
    }

    // 4. Readouts.
    L.storeGlow = approach(L.storeGlow, clamp01(storeActivity), 5, dt);
    const store = state.nodes.store;
    store.load = L.storeGlow;
    // How many DISTINCT workers currently BELIEVE they hold the lock. A paused
    // holder still believes it does — so two believers is the split-brain the
    // whole lesson is about: the lock service has re-granted while the old
    // holder never learned it lost the lease.
    const believers = WORKERS.filter((id) => L.workers[id].hasLease).length;
    store.meta = { token: L.storeToken, writers: believers };

    // Each worker's badge reads the token IT believes its lease carries — 0
    // when it holds nothing. The split-brain is legible when both show a token
    // and the numbers disagree.
    for (const id of WORKERS) {
      const w = L.workers[id];
      state.nodes[id].meta = { token: w.hasLease ? w.token : 0 };
    }

    state.metrics.storeToken = L.storeToken;
    state.metrics.goodWrites = L.goodWrites;
    state.metrics.corruptWrites = L.corruptWrites;
    state.metrics.rejectedWrites = L.rejectedWrites;
    state.metrics.believers = believers;
  },

  timeline: [
    {
      at: 1,
      caption:
        "worker-a asks the lock service for the lease, gets a grant carrying token 1, and starts writing (green).",
    },
    {
      at: 6,
      caption:
        "Steady state: one holder, writes accepted in order. The store keeps the highest token it has seen.",
    },
    {
      at: 9,
      when: (s) => !s.lesson.readerPausedA,
      caption:
        "⏸ worker-a is PAUSED — a GC pause, a descheduled VM. It stops writing, but so does its sense of time: its lease clock is frozen too.",
      apply: (s) => {
        s.lesson.workers["worker-a"].pausedUntil =
          s.t + s.lesson.curLease + PAUSE_MARGIN;
      },
    },
    {
      at: 11,
      when: (s) => s.lesson.heldBy === "worker-b",
      caption:
        "The lock service can't tell paused from crashed. Its lease timer runs out, and worker-b acquires the lock — token 2, legitimately.",
    },
    {
      at: 15,
      when: (s) => s.t >= 15 && s.lesson.workers["worker-a"].hasLease,
      caption:
        "☠ worker-a wakes up. Its own sense of time still says it holds the lease, so it writes — with the STALE token 1.",
    },
    {
      // Ungated verdict of the run as it plays with defaults (fencing off).
      at: 17.5,
      when: (s) => s.lesson.corruptWrites > 0,
      caption:
        "Fencing off: the stale write LANDED (red). Two workers wrote to the store — the exact corruption the lock existed to prevent.",
    },
    {
      at: 21,
      caption:
        "Turn on FENCING TOKENS and run it again: the store rejects any write below the highest token it has accepted.",
    },
  ],

  quiz: [
    {
      // Fires at 14.53s. Verified headlessly at seed 42: by t≈14.0 the lease
      // has expired (worker-a paused since t=9) and worker-b has acquired the
      // lock with token 2; worker-a is still frozen (pausedUntil≈15.53) so it
      // has NOT yet woken or written its stale token, and corruptWrites=0. The
      // stale write does not land until ~t=16.8, so this fires well before its
      // own proof. Ungated, so it pins into the golden.
      id: "dl-stale-write",
      at: 14.5,
      question:
        "worker-a has been paused past its lease. The lease expired, worker-b acquired the lock with a fresh token, and worker-a is about to wake up still believing it holds the lock. With fencing OFF, what happens when the woken worker-a writes?",
      choices: [
        {
          id: "lands",
          label:
            "Its write lands — the store has no way to know the writer's lease expired, so two workers have now written",
        },
        {
          id: "blocked",
          label: "The lock service blocks it, because worker-b holds the lock now",
        },
        {
          id: "clock",
          label: "Nothing — worker-a will notice its lease expired and back off",
        },
      ],
      correctChoiceId: "lands",
      explain:
        "The write goes straight to the store, which knows nothing about leases — it just records what it is told. worker-a never learns its lease lapsed, because it was frozen through the expiry and woke up trusting its own stale sense of time; the lock service is not on the write path and cannot intervene. So the stale write lands beside worker-b's, and now two writers have touched the shared resource. No timeout fixes this: the pause can always exceed whatever expiry you pick. The only fix is to make the STORE reject the stale writer — fencing tokens.",
    },
  ],

  meters: [
    { metricKey: "storeToken", label: "store token", kind: "counter" },
    { metricKey: "goodWrites", label: "writes accepted", kind: "counter" },
    {
      metricKey: "corruptWrites",
      label: "stale writes landed",
      kind: "counter",
      dangerAbove: 0,
    },
    {
      metricKey: "rejectedWrites",
      label: "writes rejected",
      kind: "counter",
    },
  ],
};
