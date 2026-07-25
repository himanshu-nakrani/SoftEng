"use client";

import { Button } from "@/components/ui/Button";
import { useHydrated } from "@/hooks/use-hydrated";
import { cn } from "@/lib/cn";
import {
  buildProgressExport,
  isEmptyProgress,
  useProgress,
  type ImportSummary,
} from "@/stores/progress";
import { Download, RotateCcw, Upload } from "lucide-react";
import { useCallback, useRef, useState } from "react";

type Status = { tone: "ok" | "warn" | "error"; text: string } | null;

const CONFIRM_WORD = "reset";

function summarize(s: ImportSummary): string {
  if (s.sectionsAdded === 0 && s.quizzesAdded === 0 && s.quizzesUpdated === 0) {
    return "Nothing new in that file — your progress already covers it.";
  }
  const parts = [
    `${s.sectionsAdded} section${s.sectionsAdded === 1 ? "" : "s"}`,
    `${s.quizzesAdded + s.quizzesUpdated} checkpoint${
      s.quizzesAdded + s.quizzesUpdated === 1 ? "" : "s"
    }`,
  ];
  return `Merged ${parts.join(" and ")} across ${s.lessons} lesson${
    s.lessons === 1 ? "" : "s"
  }.`;
}

/**
 * Progress data controls for /learn: export, import (merge), reset.
 *
 * Everything is client-side by construction — this is a static export with no
 * accounts, so a JSON file IS the sync mechanism between devices. Import is a
 * MERGE rather than a replace, because the alternative silently destroys work
 * done on the device receiving the file.
 */
export function ProgressSettings() {
  const hydrated = useHydrated();
  // Primitive selector: safe to subscribe with, and never read for rendering
  // numbers — only to disable affordances that would be no-ops.
  const hasProgress = useProgress(
    (s) =>
      Object.keys(s.completedSections).length > 0 ||
      Object.keys(s.quizAnswers).length > 0,
  );
  const importProgress = useProgress((s) => s.importProgress);
  const resetAll = useProgress((s) => s.resetAll);

  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  // Pre-hydration the store is empty by contract, so both flags render the
  // logged-out (disabled) markup the static HTML contains.
  const empty = !hydrated || !hasProgress;

  const onExport = useCallback(() => {
    const { completedSections, quizAnswers, lastVisited } =
      useProgress.getState();
    const payload = buildProgressExport({
      completedSections,
      quizAnswers,
      lastVisited,
    });
    if (isEmptyProgress(payload.state)) {
      setStatus({ tone: "warn", text: "No progress to export yet." });
      return;
    }

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `syslab-progress-${payload.exportedAt.slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setStatus({ tone: "ok", text: `Exported ${a.download}` });
  }, []);

  const onImportFile = useCallback(
    async (file: File) => {
      try {
        const raw: unknown = JSON.parse(await file.text());
        setStatus({ tone: "ok", text: summarize(importProgress(raw)) });
      } catch {
        setStatus({
          tone: "error",
          text: "That file isn't valid JSON — nothing was changed.",
        });
      }
    },
    [importProgress],
  );

  const onReset = useCallback(() => {
    resetAll();
    setConfirming(false);
    setConfirmText("");
    setStatus({ tone: "warn", text: "All progress cleared on this device." });
  }, [resetAll]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="tech-label mr-auto text-fg-faint">progress data</span>

        <Button size="sm" onClick={onExport} disabled={empty}>
          <Download className="size-3.5" strokeWidth={1.75} />
          Export
        </Button>

        <Button size="sm" onClick={() => fileRef.current?.click()}>
          <Upload className="size-3.5" strokeWidth={1.75} />
          Import
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            // Clear first: re-picking the same file must re-fire change.
            e.target.value = "";
            if (file) void onImportFile(file);
          }}
        />

        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setConfirming((c) => !c);
            setConfirmText("");
            setStatus(null);
          }}
          disabled={empty}
          aria-expanded={confirming}
        >
          <RotateCcw className="size-3.5" strokeWidth={1.75} />
          Reset all
        </Button>
      </div>

      {confirming && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-glow-orange/40 bg-glow-orange-dim px-3 py-2">
          <p className="text-xs text-fg-muted">
            This clears every completed section and checkpoint on this device.
            Type <span className="tech-num text-glow-orange">reset</span> to
            confirm.
          </p>
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && confirmText.trim() === CONFIRM_WORD) {
                onReset();
              }
            }}
            aria-label={`Type ${CONFIRM_WORD} to confirm`}
            placeholder={CONFIRM_WORD}
            autoComplete="off"
            spellCheck={false}
            className="h-8 w-24 rounded-md border border-border bg-bg px-2 font-mono text-xs outline-none placeholder:text-fg-faint focus:border-glow-orange"
          />
          <Button
            size="sm"
            onClick={onReset}
            disabled={confirmText.trim() !== CONFIRM_WORD}
            className="border-glow-orange/60 text-glow-orange hover:bg-glow-orange-dim"
          >
            Erase everything
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setConfirming(false);
              setConfirmText("");
            }}
          >
            Cancel
          </Button>
        </div>
      )}

      <p
        role="status"
        aria-live="polite"
        className={cn(
          "font-mono text-[11px] tracking-wide",
          status?.tone === "error"
            ? "text-glow-red"
            : status?.tone === "warn"
              ? "text-glow-orange"
              : "text-fg-faint",
        )}
      >
        {status?.text ??
          "Import merges — sections union, best checkpoint result wins."}
      </p>
    </div>
  );
}
