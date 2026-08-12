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
    <div className="min-h-screen bg-transparent md:flex">
      <Sidebar />
      <div className="min-w-0 flex-1">
        {/* mobile top bar (sidebar is hidden < md) — the menu button opens the
            same module tree in a drawer; the right side names where you are. */}
        <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border bg-bg/78 px-4 py-3 shadow-[0_10px_30px_-24px_var(--color-accent)] backdrop-blur-xl md:hidden">
          <MobileNav />
          <Link
            href="/"
            className="shrink-0 font-display text-base font-bold"
          >
            syslab
          </Link>
          <MobileCurrentLesson />
        </header>
        <main id="main" className="lesson-shell mx-auto w-full max-w-4xl px-4 py-10 md:px-8 lg:py-14">
          {children}
        </main>
      </div>
    </div>
  );
}
