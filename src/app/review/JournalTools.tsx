"use client";

import { buildJournalExport, useJournal } from "@/stores/journal";
import { Download, Import, LockKeyhole } from "lucide-react";
import { useRef, useState } from "react";

export function JournalTools() {
  const entries = useJournal((state) => state.entries);
  const importJournal = useJournal((state) => state.importJournal);
  const inputRef = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState("");
  const count = Object.keys(entries).length;

  function exportJournal() {
    const payload = buildJournalExport({ entries });
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "syslab-journal.json";
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice("Journal exported.");
  }

  async function importJournalFile(file: File) {
    try {
      const payload = JSON.parse(await file.text()) as unknown;
      const summary = importJournal(payload);
      setNotice(
        `${summary.entriesAdded + summary.entriesUpdated} reflection${summary.entriesAdded + summary.entriesUpdated === 1 ? "" : "s"} imported.`,
      );
    } catch {
      setNotice("That file could not be read as a syslab journal.");
    }
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <section
      className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-raised/30 px-4 py-3"
      aria-label="Local learning journal tools"
    >
      <p className="inline-flex items-center gap-2 text-xs text-fg-muted">
        <LockKeyhole className="size-3.5 text-accent" strokeWidth={1.75} />
        {count === 0 ? "No reflections saved yet." : `${count} local reflection${count === 1 ? "" : "s"}.`}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <span role="status" aria-live="polite" className="text-xs text-glow-green">
          {notice}
        </span>
        <input
          ref={inputRef}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          aria-label="Import a syslab journal file"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void importJournalFile(file);
          }}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs text-fg-muted transition-colors hover:border-border-bright hover:text-fg"
        >
          <Import className="size-3.5" strokeWidth={1.75} />
          Import
        </button>
        <button
          type="button"
          onClick={exportJournal}
          disabled={count === 0}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs text-fg-muted transition-colors hover:border-border-bright hover:text-fg disabled:cursor-not-allowed disabled:opacity-45"
        >
          <Download className="size-3.5" strokeWidth={1.75} />
          Export
        </button>
      </div>
    </section>
  );
}
