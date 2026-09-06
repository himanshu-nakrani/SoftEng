"use client";

import { CommandPalette } from "@/components/navigation/CommandPalette";
import { SidebarTree } from "@/components/navigation/SidebarTree";
import { Wordmark } from "@/components/navigation/SiteChrome";
import { ThemeToggle } from "@/components/navigation/ThemeToggle";
import { firstTrack, trackFromPathname, trackLabel } from "@/lib/curriculum";
import { usePathname } from "next/navigation";

/**
 * Learn-area sidebar (≥ md): logo, path link, module → lesson tree with
 * progress. Below md this is hidden and `MobileNav`'s drawer renders the same
 * `SidebarTree`.
 *
 * It also mounts the ⌘K `CommandPalette`. The palette's open shortcut is a
 * document-level listener, so it works on every learn-area page even while the
 * `aside` is `display:none` under md — the subtree still mounts and runs its
 * effects; only the visible trigger button is hidden on small screens.
 */
export function Sidebar() {
  const pathname = usePathname();
  const track = trackFromPathname(pathname) ?? firstTrack;

  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-1 overflow-y-auto border-r border-border bg-surface/50 px-3 py-5 md:flex">
      {/* wordmark row doubles as the plate header: series label on the right,
          derived from the registry so it renumbers itself as tracks land */}
      <div className="mb-4 flex items-center px-2.5">
        <Wordmark />
        <span
          className="ml-auto mr-2 font-mono text-[9px] tracking-[0.14em] text-fg-faint uppercase"
          title={track.title}
        >
          {trackLabel(track)}
        </span>
        <CommandPalette />
      </div>

      <SidebarTree />

      <div className="mt-auto flex items-center gap-2 border-t border-border px-2.5 pt-4">
        <ThemeToggle />
        <p className="font-mono text-[9px] tracking-widest text-fg-faint uppercase">
          saved locally · no account needed
        </p>
      </div>
    </aside>
  );
}
