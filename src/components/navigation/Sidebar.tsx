"use client";

import { SidebarTree } from "@/components/navigation/SidebarTree";
import Link from "next/link";

/**
 * Learn-area sidebar (≥ md): logo, path link, module → lesson tree with
 * progress. Below md this is hidden and `MobileNav`'s drawer renders the same
 * `SidebarTree`.
 */
export function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-1 overflow-y-auto border-r border-border bg-surface/50 px-3 py-5 md:flex">
      <Link href="/" className="mb-4 flex items-baseline gap-1 px-2.5">
        <span className="font-display text-lg font-bold tracking-tight">
          syslab
        </span>
        <span className="size-1.5 rounded-full bg-accent shadow-[0_0_6px_var(--color-accent)]" />
      </Link>

      <SidebarTree />

      <p className="mt-auto px-2.5 pt-4 font-mono text-[9px] tracking-widest text-fg-faint/70 uppercase">
        v0.1 · progress in localStorage
      </p>
    </aside>
  );
}
