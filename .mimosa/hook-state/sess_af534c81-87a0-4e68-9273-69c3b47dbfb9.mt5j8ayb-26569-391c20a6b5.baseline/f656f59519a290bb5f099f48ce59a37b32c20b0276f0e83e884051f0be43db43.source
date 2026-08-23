import { buttonClasses } from "@/components/ui/Button";
import {
  SiteHeader,
} from "@/components/navigation/SiteChrome";
import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

// Next already marks the not-found route noindex; restating it would emit a
// second <meta name="robots">.
export const metadata: Metadata = {
  title: "404 — no route",
  description: "That route isn't in the curriculum.",
};

/** Static export renders this to out/404.html. */
export default function NotFound() {
  return (
    <div className="relative min-h-screen">
      <div className="dot-grid dot-grid-fade pointer-events-none absolute inset-0 -z-10" />

      <SiteHeader
        width="read"
        nav={
          <span className="tech-label flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-glow-red" />
            request failed
          </span>
        }
      />

      <main
        id="main"
        className="mx-auto flex max-w-3xl flex-col px-6 py-20 sm:py-28"
      >
        <p className="tech-label mb-3 text-glow-red">status 404</p>

        <p
          aria-hidden
          className="text-outline font-display mb-6 text-[7rem] leading-[0.85] font-bold tracking-tight select-none sm:text-[11rem]"
        >
          404
        </p>

        <h1 className="font-display mb-5 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
          This route never made it out of the load balancer.
        </h1>

        <p className="mb-8 max-w-lg leading-relaxed text-fg-muted">
          Nothing is serving this path — it was moved, mistyped, or it only
          ever existed in a diagram. The track below is very much alive.
        </p>

        <p className="mb-10 font-mono text-xs leading-relaxed text-fg-faint">
          <span className="text-glow-red">&gt;</span> no healthy upstream for
          this route · 0/3 checks passing
          <span className="caret-blink ml-1 inline-block h-3 w-1.5 translate-y-0.5 bg-accent" />
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <Link href="/learn" className={buttonClasses("primary", "md")}>
            Back to the track
            <ArrowRight className="size-4" />
          </Link>
          <Link href="/" className={buttonClasses("outline", "md")}>
            Home
          </Link>
        </div>
      </main>
    </div>
  );
}
