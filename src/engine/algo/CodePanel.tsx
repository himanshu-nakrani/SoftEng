"use client";

import { cn } from "@/lib/cn";

/** Pseudocode with the active line lit — the algorithm narrating itself. */
export function CodePanel({
  code,
  activeLine,
}: {
  code: string[];
  activeLine?: number;
}) {
  return (
    <pre className="overflow-x-auto py-1 font-mono text-[11px] leading-relaxed">
      {code.map((line, i) => (
        <div
          key={i}
          className={cn(
            "flex gap-3 border-l-2 px-3 transition-colors",
            i === activeLine
              ? "border-accent bg-accent-dim text-fg"
              : "border-transparent text-fg-faint",
          )}
        >
          <span className="w-4 shrink-0 text-right select-none">
            {i + 1}
          </span>
          <code className="whitespace-pre">{line}</code>
        </div>
      ))}
    </pre>
  );
}
