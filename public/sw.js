// Offline shell (Wave 3b). Caches only the offline page and Next's hashed static files;
// pages and data always come from the network, so XP, coins and duels are never stale.
const CACHE = "lifeisgood-shell-v1";
const OFFLINE = "/offline.html";
const MAX_STATIC = 150; // old builds' chunks are dropped oldest-first, for low-storage phones

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add(OFFLINE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  // A page that can't be reached shows the offline page.
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE)));
    return;
  }
  // Hashed build files never change: serve them from the cache after the first load.
  if (new URL(request.url).pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then((hit) => hit ?? fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then(async (cache) => {
            await cache.put(request, copy);
            const keys = (await cache.keys()).filter((k) => new URL(k.url).pathname.startsWith("/_next/static/"));
            await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_STATIC)).map((k) => cache.delete(k)));
          });
        }
        return response;
      })),
    );
  }
});
