import {
  MobileCurrentLesson,
  MobileNav,
} from "@/components/navigation/MobileNav";
import { Sidebar } from "@/components/navigation/Sidebar";
import Link from "next/link";

export default function LearnLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="min-w-0 flex-1">
        {/* mobile top bar (sidebar is hidden < md) — the menu button opens the
            same module tree in a drawer; the right side names where you are. */}
        <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border bg-bg/80 px-4 py-3 backdrop-blur md:hidden">
          <MobileNav />
          <Link
            href="/"
            className="shrink-0 font-display text-base font-bold"
          >
            syslab
          </Link>
          <MobileCurrentLesson />
        </header>
        <main id="main" className="mx-auto w-full max-w-3xl px-4 py-10 md:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
