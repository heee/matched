// Minimal app-shell cache so the PWA opens instantly and installs cleanly.
// Never intercepts the Worker API (REST or WebSocket) — those must always
// hit the network. Screen/game modules not needed at startup are loaded
// on-demand via import() from app.js and land in the runtime cache after
// their first request, rather than being dumped into this precache list.
const CACHE_NAME = "matched-shell-v13";
const SHELL_FILES = [
  "./",
  "./index.html",
  "./style.css?v=13",
  "./app.js?v=13",
  "./config.js",
  "./api.js",
  "./storage.js",
  "./sync.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-1024.png",
  "./icons/icon-192-maskable.png",
  "./icons/icon-512-maskable.png",
  "./icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return; // let Google Fonts pass through
  if (event.request.method !== "GET") return;

  // Cache-first for the shell; everything else (screens/, game/ modules,
  // and any future Worker-relative same-origin path) is network-first so a
  // shipped fix is never masked by a stale cached module.
  const isShellRequest = SHELL_FILES.some((f) => url.pathname.endsWith(f.replace("./", "/").split("?")[0]));
  if (isShellRequest) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return res;
        });
      }).catch(() => caches.match("./index.html"))
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
