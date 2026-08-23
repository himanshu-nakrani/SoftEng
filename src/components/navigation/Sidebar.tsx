"use client";

import { SidebarTree } from "@/components/navigation/SidebarTree";
import { Wordmark } from "@/components/navigation/SiteChrome";

/**
 * Learn-area sidebar (≥ md): logo, path link, module → lesson tree with
 * progress. Below md this is hidden and `MobileNav`'s drawer renders the same
 * `SidebarTree`.
 */
export function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-1 overflow-y-auto border-r border-border bg-surface/50 px-3 py-5 md:flex">
      {/* wordmark row doubles as the plate header: series label on the right */}
      <div className="mb-4 flex items-baseline px-2.5">
        <Wordmark />
        <span className="ml-auto font-mono text-[9px] tracking-[0.14em] text-fg-faint uppercase">
          track 01
        </span>
      </div>

      <SidebarTree />

      <p className="mt-auto border-t border-border px-2.5 pt-4 font-mono text-[9px] tracking-widest text-fg-faint uppercase">
        saved locally · no account needed
      </p>
    </aside>
  );
}
