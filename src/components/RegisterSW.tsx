"use client";

import { useEffect } from "react";

/**
 * Registers the service worker that makes visited lessons work offline.
 *
 * Renders nothing — it exists only to own the one `useEffect` that has to run
 * in the browser. Mounted once from the root layout, so every route gets it.
 *
 * BASE PATH: the worker file is a static asset in `public/`, so on GitHub
 * Pages it is served from `/SoftEng/sw.js` and its scope must be `/SoftEng/`.
 * The prefix arrives as a prop rather than being read from
 * `process.env.NEXT_PUBLIC_BASE_PATH` here, because the layout is a server
 * component evaluated at build time and can see plain `BASE_PATH` too — the
 * variable `next.config.ts` actually keys off. Reading it there and passing it
 * down means the worker cannot end up scoped to `/` on a build that set only
 * `BASE_PATH`. See src/app/layout.tsx.
 */
export function RegisterSW({ basePath = "" }: { basePath?: string }) {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      // Dev is a no-op — but actively so. `next dev` and a local preview of the
      // static export share localhost, and a worker left behind by the preview
      // would happily serve stale production assets over the dev server.
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => {
          for (const registration of registrations) void registration.unregister();
        })
        .catch(() => {});
      return;
    }

    // Service workers need a secure context; localhost counts as one.
    const { protocol, hostname } = window.location;
    const secure =
      protocol === "https:" ||
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "[::1]";
    if (!secure) return;

    let cancelled = false;
    const register = () => {
      if (cancelled) return;
      // `register` is idempotent: the browser compares the script byte-for-byte
      // and only installs a new worker when it actually changed.
      navigator.serviceWorker
        .register(`${basePath}/sw.js`, { scope: `${basePath}/` })
        .catch(() => {
          // Offline first visit, private mode, blocked by policy — all fine.
          // The site is a static export and works identically without a worker.
        });
    };

    // Wait for load so worker install never competes with first paint.
    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
    }

    return () => {
      cancelled = true;
      window.removeEventListener("load", register);
    };
  }, [basePath]);

  return null;
}
