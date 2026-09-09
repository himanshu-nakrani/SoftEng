import {
  advancePackets,
  approach,
  clamp01,
  isAlive,
  killNode,
  reviveNode,
  shouldSpawn,
  spawnPacket,
} from "@/engine/sim-helpers";
import type { LessonSim, SimState } from "@/engine/types";

/**
 * The Outbox Pattern — archetype A (the packet engine).
 *
 * A service must do two things when it handles a request: commit a row to its
 * database, and publish an event to a broker so the rest of the system hears
 * about it. There is no transaction spanning both systems, so the ordering of
 * those two writes — and a crash landing between them — is the whole lesson.
 *
 *   dual-write: two independent writes. The row commits, then a separate
 *               publish goes to the broker. A crash between them commits the
 *               row with NO event — a silent inconsistency nobody downstream
 *               can see. (The mirror phantom — publish then crash before
 *               commit — is called out in prose; this model scripts the loss,
 *               which is the common and invisible one.)
 *   outbox:     ONE write. The row and an outbox record commit together in the
 *               same local transaction, so the event is durable the instant
 *               the data is. A separate relay drains the outbox to the broker
 *               and marks each record done. A crash after publish but before
 *               the mark re-publishes on restart — at-least-once, not exactly.
 *
 * Model — believable, NOT queueing theory. Requests arrive at a fixed rate and
 * each is one unit of work; the commit and publish legs are fixed-speed packet
 * flights rather than modelled service times, and the relay drains at a fixed
 * batch rate. There are no retries on the commit itself, no broker
 * backpressure, and no partial-batch accounting inside a single relay tick.
 * The numbers it produces are a faithful account of the ORDERING of writes and
 * of what a crash between them costs — nothing finer than that.
 */

/** A record sitting in the outbox table, waiting for the relay to publish it. */
interface OutboxRow {
  id: number;
  /** True once the relay's publish packet has reached the broker. */
  published: boolean;
}

interface OutboxState {
  /** Rows committed to the database (the source of truth). */
  committed: number;
  /** Events the broker has actually received. */
  published: number;
  /**
   * Events that will never arrive: committed rows whose publish was lost to a
   * crash in dual-write mode. This is the number that makes the lesson.
   */
  lost: number;
  /** Events published more than once — the at-least-once cost of the outbox. */
  duplicates: number;

  /** The outbox table (outbox mode only): committed rows awaiting the relay. */
  outbox: OutboxRow[];
  /** ids the broker has already seen, so a re-publish counts as a duplicate. */
  brokerSeen: Set<number>;
  /** Fractional relay-drain credit carried between ticks. */
  relayAcc: number;

  nextId: number;
  /** Sim-time the service comes back after a crash. */
  reviveAt: number;
  /** Aliveness last tick — one code path for button, timeline and click kills. */
  wasAlive: boolean;
  /**
   * A crash is armed and waiting for the telling moment: in dual-write, the
   * instant a row is committed but its publish has not yet left; in outbox,
   * the instant a relay publish has landed but its outbox row is not yet
   * marked done. Fires at that moment, or when `crashBy` lapses.
   */
  crashArmed: boolean;
  crashBy: number;
  /** A relay publish is in flight whose row must be marked done on arrival. */
  relayInFlight: number[];
  /** Crashes so far — restart captions wait on it. */
  crashes: number;

  /** Whether the learner has ever driven the mode select — latches the timeline. */
  everSwitched: boolean;
  /** Sim-time the reader switched into outbox mode (-1 = never). */
  switchedAt: number;
  /** Mode as of last tick, so a switch away from the default is detectable. */
  lastMode: string;
}

/** service → db and service → broker packet speeds (progress units/sec). */
const COMMIT_SPEED = 2.6;
const PUBLISH_SPEED = 2.4;
/** db → relay drain and relay → broker publish. Deliberately slow: the flight
 *  is the crash window, and a slow publish keeps one reliably in transit. */
const RELAY_PUBLISH_SPEED = 1.4;
/** Relay batch rate: outbox rows drained per second. Kept near the default
 *  arrival rate so the relay stays busy and a publish is usually in flight. */
const RELAY_RATE = 4;
/** A supervisor brings the service back this long after it dies. */
const RESTART_SECS = 1.6;
/** An armed crash gives up waiting for the telling moment after this long. */
const ARM_WINDOW = 5;
/** Outbox-depth bar scale. */
const OUTBOX_SCALE = 12;

/**
 * Everything a crash costs, reached identically by the CRASH SERVICE button,
 * the scripted beat, and a learner clicking the node dead.
 *
 * In dual-write, a request caught after commit but before its publish left is
 * a lost event: the row is already counted as committed, and nothing will ever
 * publish it. In outbox, an in-flight relay publish that has NOT yet marked its
 * row done is simply un-marked — the row stays in the outbox and the relay
 * re-publishes it after restart, which is where the duplicate comes from.
 */
function onCrash(state: SimState<OutboxState>, dualWrite: boolean): void {
  const L = state.lesson;
  L.crashes += 1;
  L.reviveAt = state.t + RESTART_SECS;

  // A publish packet in flight from the service dies at the corpse.
  for (const p of state.packets) {
    if (p.edgeId === "publish" && p.type === "publish") {
      p.type = "drop";
      if (dualWrite) L.lost += 1; // committed row, event never arrives
    }
    // A relay publish already on the wire still lands (the broker never learns
    // the relay died) — but the mark-done never happens, so the row remains.
  }
  // Any relay publishes awaiting their mark stay un-marked: the rows are still
  // in the outbox, so the relay will send them again.
  L.relayInFlight = [];
}

export const outboxPatternSim: LessonSim<OutboxState> = {
  id: "outbox-pattern",

  topology: {
    nodes: [
      { id: "service", kind: "server", label: "orders-svc", x: 150, y: 150, breakable: true },
      { id: "db", kind: "database", label: "orders-db", x: 430, y: 150 },
      { id: "relay", kind: "server", label: "relay", x: 430, y: 320 },
      { id: "broker", kind: "queue", label: "events", x: 690, y: 235 },
    ],
    edges: [
      { id: "commit", from: "service", to: "db" },
      { id: "publish", from: "service", to: "broker", curve: -0.4 },
      { id: "drain", from: "db", to: "relay" },
      { id: "relaypub", from: "relay", to: "broker", curve: 0.3 },
    ],
  },

  params: [
    {
      key: "mode",
      label: "write path",
      kind: "select",
      options: [
        { value: "dual-write", label: "dual write" },
        { value: "outbox", label: "outbox + relay" },
      ],
      defaultValue: "dual-write",
    },
    {
      key: "rate",
      label: "request rate",
      kind: "slider",
      min: 1,
      max: 12,
      step: 1,
      unit: " req/s",
      defaultValue: 4,
    },
    {
      key: "crash",
      label: "crash service",
      kind: "button",
      defaultValue: false,
    },
  ],

  init: () => ({
    committed: 0,
    published: 0,
    lost: 0,
    duplicates: 0,
    outbox: [],
    brokerSeen: new Set<number>(),
    relayAcc: 0,
    nextId: 1,
    reviveAt: 0,
    wasAlive: true,
    crashArmed: false,
    crashBy: 0,
    relayInFlight: [],
    crashes: 0,
    everSwitched: false,
    switchedAt: -1,
    lastMode: "dual-write",
  }),

  step: (state, dt, params) => {
    const L = state.lesson;
    const dualWrite = String(params.mode) !== "outbox";
    const rate = Number(params.rate);

    // Latch once the reader drives the mode select away from what it was.
    const modeNow = String(params.mode);
    if (modeNow !== L.lastMode) {
      L.everSwitched = true;
      if (modeNow === "outbox") L.switchedAt = state.t;
      L.lastMode = modeNow;
    }

    // The relay node is only part of the story in outbox mode: ghost it out in
    // dual-write so the reader sees the two-write topology unadorned.
    state.nodes.relay.ghost = dualWrite;

    /* 1. The button. Arms a crash rather than firing it blind: a kill while
       nothing telling is on the wire teaches nothing, so it waits (at most
       ARM_WINDOW) for the moment that exposes each mode's failure. */
    if (params.crash === true) {
      params.crash = false; // consume the press
      if (isAlive(state, "service")) {
        L.crashArmed = true;
        L.crashBy = state.t + ARM_WINDOW;
      }
    }
    if (L.crashArmed && isAlive(state, "service")) {
      const telling = dualWrite
        ? // a commit landed and its publish is now on the wire — kill it there
          state.packets.some((p) => p.edgeId === "publish" && p.type === "publish")
        : // a relay publish has landed but its row is not yet marked done
          L.relayInFlight.length > 0;
      if (telling || state.t >= L.crashBy) {
        L.crashArmed = false;
        killNode(state, "service");
      }
    }

    /* 2. Death and resurrection, detected as a transition so a click costs
       exactly what the button costs. Only the service is breakable. */
    const alive = isAlive(state, "service");
    if (L.wasAlive && !alive) onCrash(state, dualWrite);
    if (!alive && state.t >= L.reviveAt) reviveNode(state, "service");
    L.wasAlive = isAlive(state, "service");
    const serviceUp = L.wasAlive;

    /* 3. Requests arrive. Each one is a commit: a packet down the `commit`
       edge to orders-db. The service does not publish here — that is the
       SECOND write, and it only happens once the commit has landed. */
    if (serviceUp) {
      const spawns = shouldSpawn(state, rate, dt);
      for (let i = 0; i < spawns; i++) {
        const id = L.nextId++;
        spawnPacket(state, "commit", "commit", { speed: COMMIT_SPEED, payload: { id } });
      }
    }

    /* 4. Arrivals. */
    for (const p of advancePackets(state, dt)) {
      if (p.type === "drop") continue; // died at a corpse; already accounted for
      const id = typeof p.payload?.id === "number" ? p.payload.id : -1;

      if (p.edgeId === "commit") {
        // The row commits. In dual-write that is all this transaction does; in
        // outbox the SAME transaction also writes the outbox row — one write.
        L.committed += 1;
        if (dualWrite) {
          // Second, independent write: publish to the broker. The gap between
          // "committed" above and this packet arriving is where a crash lands.
          spawnPacket(state, "publish", "publish", {
            speed: PUBLISH_SPEED,
            payload: { id },
          });
        } else {
          L.outbox.push({ id, published: false });
        }
        continue;
      }

      if (p.edgeId === "publish") {
        // dual-write: the event reached the broker. Nothing was lost this time.
        if (!L.brokerSeen.has(id)) {
          L.brokerSeen.add(id);
          L.published += 1;
        } else {
          L.duplicates += 1;
        }
        continue;
      }

      if (p.edgeId === "relaypub") {
        // outbox: a relay publish landed at the broker. The broker records it
        // (or notes a repeat) either way — the broker never learns the relay
        // died. The MARK-DONE, though, only happens if the relay is still
        // tracking this publish; a crash cleared that tracking, so the row
        // stays in the outbox and will be published again after restart.
        if (L.brokerSeen.has(id)) {
          L.duplicates += 1;
        } else {
          L.brokerSeen.add(id);
          L.published += 1;
        }
        const stillTracked = L.relayInFlight.includes(id);
        L.relayInFlight = L.relayInFlight.filter((x) => x !== id);
        if (stillTracked) {
          const row = L.outbox.find((r) => r.id === id);
          if (row) row.published = true; // the mark the crash interrupts
        }
        continue;
      }
    }

    /* 5. The relay (outbox mode only). It drains unpublished outbox rows at a
       fixed batch rate and publishes each to the broker. The mark-done happens
       only when the publish LANDS (step 4), so a crash in between leaves the
       row and the relay sends it again — the source of duplicates. */
    if (!dualWrite && serviceUp) {
      L.relayAcc += RELAY_RATE * dt;
      while (L.relayAcc >= 1) {
        const row = L.outbox.find(
          (r) => !r.published && !L.relayInFlight.includes(r.id),
        );
        if (!row) break;
        L.relayAcc -= 1;
        L.relayInFlight.push(row.id);
        spawnPacket(state, "relaypub", "publish", {
          speed: RELAY_PUBLISH_SPEED,
          payload: { id: row.id },
        });
      }
      if (L.relayAcc > 1) L.relayAcc = 1; // no teleporting after an idle stretch
    } else {
      L.relayAcc = 0;
    }
    // Drop published rows from the table so the outbox depth means "backlog".
    if (L.outbox.length > 0) {
      L.outbox = L.outbox.filter((r) => !r.published);
    }

    /* 6. Readouts. `gap` is the inconsistency the reader is meant to watch:
       committed rows the broker has never heard about AND has no pending write
       that will ever tell it. In-flight publishes and outbox backlog are
       pending, not lost, so they are subtracted — the gap only counts events
       that nothing will ever deliver. In dual-write a crash strands one there
       permanently; in outbox the gap stays at zero because every committed row
       has a durable outbox record still owed to the relay. */
    const outboxDepth = L.outbox.length;
    const inFlightPublish = state.packets.filter(
      (p) => (p.edgeId === "publish" || p.edgeId === "relaypub") && p.type === "publish",
    ).length;
    const pending = dualWrite ? inFlightPublish : outboxDepth + inFlightPublish;
    const gap = Math.max(0, L.committed - L.published - pending);

    state.nodes.service.load = approach(
      state.nodes.service.load,
      serviceUp ? clamp01(rate / 12) : 0,
      5,
      dt,
    );
    state.nodes.db.load = approach(state.nodes.db.load, serviceUp ? 0.25 : 0.05, 3, dt);
    if (!dualWrite) {
      state.nodes.relay.queueDepth = outboxDepth;
      state.nodes.relay.load = approach(
        state.nodes.relay.load,
        serviceUp ? clamp01(outboxDepth / OUTBOX_SCALE) : 0,
        6,
        dt,
      );
    }

    state.metrics.committed = L.committed;
    state.metrics.published = L.published;
    state.metrics.gap = gap;
    state.metrics.lost = L.lost;
    state.metrics.duplicates = L.duplicates;
  },

  packetStyles: {
    // The commit — a write to the database, the source of truth. Amber.
    commit: { color: "var(--color-accent)", size: 4.5 },
    // The event on its way to the broker. Cyan is the demoted info hue; an
    // event is bookkeeping about a fact the commit already made true.
    publish: { color: "var(--color-glow-cyan)", size: 4 },
  },

  timeline: [
    {
      at: 1.5,
      caption:
        "Amber → a commit to orders-db. Cyan → the event published to the broker. Two separate writes, two separate systems.",
    },
    {
      at: 6,
      caption:
        "No transaction spans both. The commit lands first; the publish is a second, independent write.",
    },
    {
      at: 10,
      caption:
        "⚡ The service is about to crash in the gap — after a row commits, before its event is published.",
      apply: (s) => {
        s.lesson.crashArmed = true;
        s.lesson.crashBy = s.t + ARM_WINDOW;
      },
      // Skip the scripted crash if the reader already switched to outbox mode
      // to explore it themselves — the lost-event beat is a dual-write claim.
      when: (s, params) => String(params.mode) !== "outbox" && !s.lesson.everSwitched,
    },
    {
      at: 15,
      caption:
        "☠ Committed, never published. The row exists; the event is gone. Nothing downstream will ever know.",
      when: (s, params) => String(params.mode) !== "outbox" && s.lesson.lost >= 1,
    },
    {
      at: 15,
      caption:
        "Switch WRITE PATH to outbox + relay. Now the row and its outbox record commit together, and the relay drains them to the broker.",
      when: (s) => s.lesson.everSwitched && s.lesson.switchedAt < 0,
    },
    {
      // Once the reader is in outbox mode, crash the relay mid-publish so a
      // passive reader still sees the at-least-once cost. Waits ~4s after the
      // switch so the relay is busy, and only ever fires the once.
      at: 15,
      caption:
        "⚡ Now crash the service while the relay is mid-publish — after the event landed, before the outbox row is marked done.",
      when: (s) =>
        s.lesson.switchedAt >= 0 &&
        s.t >= s.lesson.switchedAt + 4 &&
        s.lesson.crashes === 0,
      apply: (s) => {
        s.lesson.crashArmed = true;
        s.lesson.crashBy = s.t + ARM_WINDOW;
      },
    },
    {
      at: 15,
      caption:
        "The event was published, then published AGAIN after restart — the outbox row was never marked done. At-least-once: nothing lost, some repeated.",
      when: (s) => s.lesson.switchedAt >= 0 && s.lesson.duplicates >= 1,
    },
  ],

  quiz: [
    {
      // Fires at 12.5s, after the scripted crash has landed but BEFORE the
      // t=15 caption spells out the consequence. Premise verified at seed 42:
      // by 12.5s the crash has committed rows with a lost publish, so
      // committed > published and lost >= 1 already hold (see report).
      id: "outbox-lost-event",
      at: 12.5,
      question:
        "The service committed the row, then crashed before the publish left. The counters read committed 36, published 35, lost 1. What is true of that row's event?",
      choices: [
        { id: "gone", label: "It is gone — the row is committed and nothing will ever publish it" },
        { id: "retry", label: "The service republishes it automatically when it restarts" },
        { id: "rollback", label: "The commit rolls back, so the row and the event both disappear" },
      ],
      correctChoiceId: "gone",
      explain:
        "The two writes are independent: the commit already succeeded and there is no transaction to roll it back, and the publish never happened. Nothing holds a record that this event is owed, so nothing will ever send it. Downstream systems are now permanently inconsistent with orders-db, and no counter anywhere is wrong enough to notice. The fix is to make the event part of the same write as the row.",
    },
  ],

  meters: [
    { metricKey: "committed", label: "committed rows", kind: "counter" },
    { metricKey: "published", label: "published events", kind: "counter" },
    {
      // Committed rows the broker has never heard about. The whole lesson is
      // whether this settles to zero or stays stuck above it.
      metricKey: "gap",
      label: "unpublished",
      kind: "counter",
      dangerAbove: 0,
    },
    {
      // dual-write's failure: events that will never arrive.
      metricKey: "lost",
      label: "lost events",
      kind: "counter",
      dangerAbove: 0,
    },
    {
      // outbox's honest cost: at-least-once means the relay repeats.
      metricKey: "duplicates",
      label: "duplicate events",
      kind: "counter",
    },
  ],
};
