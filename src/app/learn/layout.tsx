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
        {/* mobile top bar (sidebar is hidden < md) */}
        <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border bg-bg/80 px-4 py-3 backdrop-blur md:hidden">
          <Link href="/" className="font-display text-base font-bold">
            syslab
          </Link>
          <Link href="/learn" className="ml-auto text-sm text-fg-muted">
            Learning path
          </Link>
        </header>
        <main className="mx-auto w-full max-w-3xl px-4 py-10 md:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
