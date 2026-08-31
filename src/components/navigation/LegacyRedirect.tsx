"use client";

import { buttonClasses } from "@/components/ui/Button";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Sends a moved URL to its new home.
 *
 * Uses the router rather than a `<meta http-equiv="refresh">` because the
 * deploy target is a GitHub Pages project site: a raw meta tag would carry a
 * root-relative URL with no `basePath`, so `/learn/…` would 404 under
 * `/SoftEng/learn/…`. `router.replace` and `<Link>` both prepend the base path
 * for us, and `replace` keeps the dead URL out of the back-button history.
 *
 * The visible link is the no-JS path, not decoration — it is the only thing
 * that works if the script never runs.
 */
export function LegacyRedirect({
  href,
  title,
}: {
  href: string;
  title: string;
}) {
  const router = useRouter();

  useEffect(() => {
    router.replace(href);
  }, [router, href]);

  return (
    <div className="mx-auto max-w-3xl py-16">
      <p className="tech-label mb-2">this lesson moved</p>
      <h1 className="font-display mb-3 text-2xl font-bold tracking-tight">
        {title}
      </h1>
      <p className="mb-6 leading-relaxed text-fg-muted">
        Lessons now live under their track. Taking you there — if nothing
        happens, follow the link.
      </p>
      <Link href={href} className={buttonClasses("primary", "md")}>
        Go to the lesson
        <ArrowRight className="size-4" strokeWidth={1.75} />
      </Link>
    </div>
  );
}
