/**
 * syslab service worker — hand-written, zero dependencies.
 *
 * The site is a static export (HTML + content-hashed /_next/static assets), so
 * there is no server to talk to and nothing to revalidate against. That makes
 * the offline story simple: cache what the learner actually visits, and let
 * hashed assets live forever.
 *
 * WHY RUNTIME CACHING AND NOT A PRECACHE MANIFEST: enumerating all 22 lessons'
 * HTML + RSC payloads + chunk graph at SW-authoring time would need a build
 * step that injects a generated file list. This worker deliberately avoids that
 * coupling — it precaches only the shell (4 URLs) and learns the rest from
 * traffic. Consequence, by design: a lesson you have never opened while online
 * is NOT available offline; the browser shows its own offline page for it.
 *
 * BASE PATH: on GitHub Pages the site lives under /SoftEng/. Nothing here
 * hardcodes that — every path is derived from `self.registration.scope`, which
 * is the directory the worker script was served from.
 */

const VERSION = "v1";

/** Precached shell. Tiny, never trimmed. */
const CORE_CACHE = `syslab-core-${VERSION}`;
/** Content-hashed /_next/static assets. Immutable ⇒ cache-first. */
const ASSET_CACHE = `syslab-assets-${VERSION}`;
/** Documents, RSC payloads, icons, OG images. Mutable ⇒ revalidated. */
const RUNTIME_CACHE = `syslab-runtime-${VERSION}`;

const CURRENT_CACHES = [CORE_CACHE, ASSET_CACHE, RUNTIME_CACHE];

/**
 * Entry caps. Over the cap the oldest entries are dropped — the Cache Storage
 * key order is insertion order, so the head of `keys()` is the least recently
 * *added* entry. Not a true LRU (a read does not refresh recency), which is the
 * right trade here: hashed assets never change, so age is a fine proxy.
 *
 * One full deploy is ~120 hashed assets (75 JS + 2 CSS + ~35 fonts), so 220
 * holds an entire deploy plus a rolling second one without evicting a chunk
 * some already-cached page still needs.
 */
const ASSET_MAX = 220;
const RUNTIME_MAX = 120;

/** e.g. "https://user.github.io/SoftEng/" — the scope, never a literal. */
const SCOPE = new URL(self.registration.scope);
/** e.g. "/SoftEng/" or "/". Always has a trailing slash. */
const BASE = SCOPE.pathname;

const PRECACHE = [
  BASE, // the site root document — the one page always worth having
  `${BASE}manifest.webmanifest`,
  `${BASE}icons/icon-192.png`,
  `${BASE}icons/icon-512.png`,
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CORE_CACHE);
      // Tolerant on purpose: `cache.addAll` is atomic, so a single 404 would
      // fail the whole install and leave the site with no worker at all.
      await Promise.all(PRECACHE.map((url) => putIfCacheable(cache, url)));
      // Take over on first load rather than waiting for every tab to close.
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((n) => n.startsWith("syslab-") && !CURRENT_CACHES.includes(n))
          .map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Only same-origin GETs inside our scope. Anything else (POST, other
  // origins, range requests for media) falls through to the network untouched.
  if (request.method !== "GET") return;
  if (request.headers.has("range")) return;

  const url = new URL(request.url);
  if (url.origin !== SCOPE.origin) return;
  if (!url.pathname.startsWith(BASE)) return;

  if (url.pathname.startsWith(`${BASE}_next/static/`)) {
    event.respondWith(cacheFirst(event));
  } else if (request.mode === "navigate") {
    event.respondWith(networkFirst(event));
  } else {
    event.respondWith(staleWhileRevalidate(event));
  }
});

/* -------------------------------------------------------------------------
   Strategies
   ---------------------------------------------------------------------- */

/** Hashed and immutable: if we have it, it is correct. */
async function cacheFirst(event) {
  const cache = await caches.open(ASSET_CACHE);
  const hit = await cache.match(event.request);
  if (hit) return hit;

  const response = await fetch(event.request);
  if (isCacheable(response)) {
    const copy = response.clone();
    event.waitUntil(store(cache, event.request, copy, ASSET_CACHE, ASSET_MAX));
  }
  return response;
}

/** Documents: a deploy must win while online, a visited page must work offline. */
async function networkFirst(event) {
  try {
    const response = await fetch(event.request);
    if (isCacheable(response)) {
      const cache = await caches.open(RUNTIME_CACHE);
      const copy = response.clone();
      event.waitUntil(
        store(cache, event.request, copy, RUNTIME_CACHE, RUNTIME_MAX),
      );
    }
    return response;
  } catch (error) {
    const hit = await fromCache(event.request);
    if (hit) return hit;
    // Never visited: rethrow so the browser shows its own offline page rather
    // than us faking a shell for a route whose HTML we do not have.
    throw error;
  }
}

/** Everything else: instant from cache, refreshed in the background. */
async function staleWhileRevalidate(event) {
  const cache = await caches.open(RUNTIME_CACHE);
  const hit = await fromCache(event.request);

  const network = fetch(event.request)
    .then((response) => {
      if (isCacheable(response)) {
        const copy = response.clone();
        return store(
          cache,
          event.request,
          copy,
          RUNTIME_CACHE,
          RUNTIME_MAX,
        ).then(() => response);
      }
      return response;
    })
    .catch(() => undefined);

  if (hit) {
    event.waitUntil(network);
    return hit;
  }
  return (await network) ?? Response.error();
}

/* -------------------------------------------------------------------------
   Helpers
   ---------------------------------------------------------------------- */

/**
 * Cached copy of a request, newest source first.
 *
 * Order matters and `caches.match()` gets it wrong: that helper walks caches in
 * creation order, so the install-time shell in CORE — which is only rewritten
 * when sw.js itself changes — would shadow the copy runtime caching refreshed
 * on the last online visit. Checking RUNTIME first means CORE only ever answers
 * for URLs no visit has since replaced.
 */
async function fromCache(request) {
  for (const name of [RUNTIME_CACHE, CORE_CACHE]) {
    const cache = await caches.open(name);
    const hit = await cache.match(request, { ignoreSearch: true });
    if (hit) return hit;
  }
  return undefined;
}

/**
 * A response is worth keeping only if it is a real 2xx from our own origin.
 * Redirects are excluded because `cache.put` rejects on them, and opaque
 * cross-origin responses are excluded because we cannot tell success from 404.
 */
function isCacheable(response) {
  return Boolean(
    response &&
      response.ok &&
      !response.redirected &&
      response.type === "basic",
  );
}

async function putIfCacheable(cache, url) {
  try {
    // `reload` so an install never bakes in a stale HTTP-cached copy.
    const response = await fetch(url, { cache: "reload" });
    if (isCacheable(response)) await cache.put(url, response);
  } catch {
    // A shell URL that is unreachable at install time is not fatal; runtime
    // caching will pick it up on the first successful visit.
  }
}

async function store(cache, request, response, cacheName, max) {
  await cache.put(request, response);
  await trim(cacheName, max);
}

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  const excess = keys.length - max;
  if (excess <= 0) return;
  for (const key of keys.slice(0, excess)) await cache.delete(key);
}
