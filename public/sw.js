/* Sudoku service worker: offline-first app shell.
 *
 * `scripts/postbuild.mjs` replaces the two placeholders below with the real build
 * id and the list of every file in the static export, so the whole app is cached
 * on first visit and works with no network at all.
 */
const BUILD_ID = "__BUILD_ID__";
const PRECACHE_URLS = /*__PRECACHE_URLS__*/ [];

const PRECACHE = `sudoku-precache-${BUILD_ID}`;
const RUNTIME = `sudoku-runtime-${BUILD_ID}`;
const NAVIGATION_TIMEOUT_MS = 3500;

const OFFLINE_HTML = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline</title>
<body style="font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;background:#eef0e8;color:#17181a;text-align:center">
<div><h1 style="font-weight:600;margin:0 0 8px">You're offline</h1><p style="margin:0;color:#565a62">Open Sudoku once while connected and it will work offline from then on.</p></div>`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PRECACHE);
      // One missing file must not abort the install.
      await Promise.allSettled(PRECACHE_URLS.map((url) => cache.add(new Request(url, { cache: "reload" }))));
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([PRECACHE, RUNTIME]);
      for (const key of await caches.keys()) {
        if (key.startsWith("sudoku-") && !keep.has(key)) await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

async function fromCaches(request, options) {
  return (await (await caches.open(PRECACHE)).match(request, options)) || (await (await caches.open(RUNTIME)).match(request, options));
}

async function putRuntime(request, response) {
  if (response && response.ok && response.type === "basic") {
    const cache = await caches.open(RUNTIME);
    await cache.put(request, response.clone());
  }
  return response;
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/** Immutable, content-hashed assets: cache first. */
async function cacheFirst(request) {
  const hit = await fromCaches(request, { ignoreSearch: true });
  if (hit) return hit;
  return putRuntime(request, await fetch(request));
}

/** Pages and route payloads: prefer fresh, fall back to what we have. */
async function networkFirst(request, fallbackToShell) {
  try {
    const response = await withTimeout(fetch(request), NAVIGATION_TIMEOUT_MS);
    await putRuntime(request, response);
    return response;
  } catch {
    const hit = await fromCaches(request, { ignoreSearch: true });
    if (hit) return hit;
    if (fallbackToShell) {
      const shell = await fromCaches("/", { ignoreSearch: true });
      if (shell) return shell;
      return new Response(OFFLINE_HTML, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } });
    }
    return new Response("", { status: 504 });
  }
}

async function staleWhileRevalidate(request) {
  const hit = await fromCaches(request);
  const refresh = fetch(request)
    .then((response) => putRuntime(request, response))
    .catch(() => undefined);
  return hit || (await refresh) || new Response("", { status: 504 });
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // API and auth calls are never intercepted
  if (url.pathname === "/sw.js") return;

  if (url.pathname.startsWith("/_next/static/") || /\.(?:woff2?|png|svg|ico|webmanifest)$/.test(url.pathname)) {
    event.respondWith(cacheFirst(request));
  } else if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, true));
  } else if (url.pathname.endsWith(".txt") || request.headers.get("RSC")) {
    event.respondWith(networkFirst(request, false));
  } else {
    event.respondWith(staleWhileRevalidate(request));
  }
});
