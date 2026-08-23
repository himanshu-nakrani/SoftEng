"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Confidence = "uncertain" | "getting-it" | "can-explain";

/** Replay-ready fields are optional today and become the hand-off to Replay Lab. */
export interface ReplayPointer {
  lessonSlug: string;
  sectionId?: string;
  quizId?: string;
  at?: number;
  seed?: number;
  params?: Record<string, number | string | boolean>;
}

export interface JournalEntry {
  note: string;
  confidence: Confidence;
  updatedAt: string;
  replay: ReplayPointer | null;
}

export interface PersistedJournal {
  entries: Record<string, JournalEntry>;
}

export interface JournalExport {
  app: "syslab-journal";
  version: number;
  exportedAt: string;
  state: PersistedJournal;
}

export interface JournalImportSummary {
  entriesAdded: number;
  entriesUpdated: number;
}

export const JOURNAL_VERSION = 1;
export const JOURNAL_NOTE_LIMIT = 480;

const emptyJournal = (): PersistedJournal => ({ entries: {} });

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isConfidence(value: unknown): value is Confidence {
  return value === "uncertain" || value === "getting-it" || value === "can-explain";
}

function sanitizeReplay(value: unknown): ReplayPointer | null {
  if (!isRecord(value) || typeof value.lessonSlug !== "string") return null;
  const replay: ReplayPointer = {
    lessonSlug: value.lessonSlug.slice(0, 120),
  };
  if (typeof value.sectionId === "string") replay.sectionId = value.sectionId.slice(0, 120);
  if (typeof value.quizId === "string") replay.quizId = value.quizId.slice(0, 120);
  if (typeof value.at === "number" && Number.isFinite(value.at)) replay.at = Math.max(0, value.at);
  if (typeof value.seed === "number" && Number.isFinite(value.seed)) replay.seed = value.seed;
  if (isRecord(value.params)) {
    const params: Record<string, number | string | boolean> = {};
    for (const [key, parameter] of Object.entries(value.params).slice(0, 24)) {
      if (
        typeof parameter === "number" ||
        typeof parameter === "string" ||
        typeof parameter === "boolean"
      ) {
        params[key] = parameter;
      }
    }
    replay.params = params;
  }
  return replay;
}

function sanitizeEntry(value: unknown): JournalEntry | null {
  if (!isRecord(value)) return null;
  const note = typeof value.note === "string" ? value.note.trim().slice(0, JOURNAL_NOTE_LIMIT) : "";
  const confidence = isConfidence(value.confidence) ? value.confidence : "uncertain";
  const updatedAt = typeof value.updatedAt === "string" ? value.updatedAt : new Date(0).toISOString();
  return {
    note,
    confidence,
    updatedAt,
    replay: sanitizeReplay(value.replay),
  };
}

export function sanitizeJournal(raw: unknown): PersistedJournal {
  if (!isRecord(raw) || !isRecord(raw.entries)) return emptyJournal();
  const entries: Record<string, JournalEntry> = {};
  for (const [slug, value] of Object.entries(raw.entries)) {
    const entry = sanitizeEntry(value);
    if (entry) entries[slug.slice(0, 120)] = entry;
  }
  return { entries };
}

export function buildJournalExport(state: PersistedJournal): JournalExport {
  return {
    app: "syslab-journal",
    version: JOURNAL_VERSION,
    exportedAt: new Date().toISOString(),
    state: sanitizeJournal(state),
  };
}

export function readJournalExport(raw: unknown): PersistedJournal {
  if (isRecord(raw) && isRecord(raw.state)) return sanitizeJournal(raw.state);
  return sanitizeJournal(raw);
}

export function mergeJournal(
  base: PersistedJournal,
  incoming: PersistedJournal,
): { next: PersistedJournal; summary: JournalImportSummary } {
  const entries = { ...base.entries };
  let entriesAdded = 0;
  let entriesUpdated = 0;
  for (const [slug, theirs] of Object.entries(incoming.entries)) {
    const mine = entries[slug];
    if (!mine) {
      entries[slug] = theirs;
      entriesAdded += 1;
      continue;
    }
    const mineTime = Date.parse(mine.updatedAt);
    const theirsTime = Date.parse(theirs.updatedAt);
    if (!Number.isFinite(mineTime) || theirsTime >= mineTime) {
      entries[slug] = theirs;
      entriesUpdated += 1;
    }
  }
  return { next: { entries }, summary: { entriesAdded, entriesUpdated } };
}

interface JournalState extends PersistedJournal {
  setEntry: (lessonSlug: string, patch: Partial<Pick<JournalEntry, "note" | "confidence" | "replay">>) => void;
  clearEntry: (lessonSlug: string) => void;
  importJournal: (raw: unknown) => JournalImportSummary;
  resetAll: () => void;
}

export const useJournal = create<JournalState>()(
  persist(
    (set, get) => ({
      ...emptyJournal(),
      setEntry: (lessonSlug, patch) =>
        set((state) => {
          const current = state.entries[lessonSlug];
          const next: JournalEntry = {
            note: patch.note === undefined ? current?.note ?? "" : patch.note.trim().slice(0, JOURNAL_NOTE_LIMIT),
            confidence: patch.confidence ?? current?.confidence ?? "uncertain",
            replay: patch.replay === undefined ? current?.replay ?? null : patch.replay,
            updatedAt: new Date().toISOString(),
          };
          return { entries: { ...state.entries, [lessonSlug]: next } };
        }),
      clearEntry: (lessonSlug) =>
        set((state) => {
          const entries = { ...state.entries };
          delete entries[lessonSlug];
          return { entries };
        }),
      importJournal: (raw) => {
        const { next, summary } = mergeJournal({ entries: get().entries }, readJournalExport(raw));
        set(next);
        return summary;
      },
      resetAll: () => set(emptyJournal()),
    }),
    {
      name: "softeng-journal",
      version: JOURNAL_VERSION,
      migrate: (state) => sanitizeJournal(state),
      merge: (persisted, current) => ({
        ...current,
        ...sanitizeJournal(persisted),
      }),
      partialize: (state) => ({ entries: state.entries }),
    },
  ),
);
