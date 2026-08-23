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
      <Wordmark className="mb-4 px-2.5" />

      <SidebarTree />

      <p className="mt-auto px-2.5 pt-4 font-mono text-[9px] tracking-widest text-fg-faint uppercase">
        v0.1 · progress in localStorage
      </p>
    </aside>
  );
}
