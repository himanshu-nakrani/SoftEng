"use client";

import { AnimatePresence, motion } from "motion/react";

/** Timeline narration, bottom-left of the stage. */
export function CaptionOverlay({ caption }: { caption: string | null }) {
  return (
    <AnimatePresence>
      {caption && (
        <motion.div
          key={caption}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="pointer-events-none absolute bottom-3 left-3 flex max-w-[85%] items-center gap-2 rounded-lg border border-border bg-bg/85 px-3 py-2 backdrop-blur-sm"
        >
          <span className="h-3.5 w-0.5 shrink-0 rounded-full bg-glow-amber shadow-[0_0_6px_var(--color-glow-amber)]" />
          <p className="font-mono text-xs leading-snug text-fg">{caption}</p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
