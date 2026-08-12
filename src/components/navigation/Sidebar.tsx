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
    <aside className="sidebar-shell sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-1 overflow-y-auto border-r border-border/80 px-3 py-5 md:flex">
      <Link href="/" className="group mb-5 flex items-baseline gap-1.5 px-2.5">
        <span className="font-display text-lg font-bold tracking-tight transition-colors group-hover:text-accent">
          syslab
        </span>
        <span className="size-1.5 rounded-full bg-accent shadow-[0_0_8px_var(--color-accent)] transition-shadow group-hover:shadow-[0_0_14px_var(--color-accent)]" />
        <span className="ml-auto font-mono text-[9px] tracking-[0.14em] text-fg-faint uppercase">track 01</span>
      </Link>

      <SidebarTree />

      <p className="mt-auto border-t border-border/65 px-2.5 pt-4 font-mono text-[9px] tracking-widest text-fg-muted uppercase">
        v0.1 · progress in localStorage
      </p>
    </aside>
  );
}
