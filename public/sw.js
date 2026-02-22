const CACHE_NAME = "hotel-sprzatanie-v3";
const STATIC_CACHE = "hotel-static-v3";
const OFFLINE_URL = "/sprzatanie";

const STATIC_ASSETS = [
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/logo.png",
  "/logo.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      await cache.addAll(STATIC_ASSETS);
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== STATIC_CACHE)
          .map((name) => caches.delete(name))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (url.pathname.startsWith("/api/")) {
    return;
  }

  if (event.request.method !== "GET") {
    return;
  }

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(STATIC_CACHE);
        const cachedResponse = await cache.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }
        try {
          const networkResponse = await fetch(event.request);
          if (networkResponse.ok) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        } catch (error) {
          return new Response("", { status: 408 });
        }
      })()
    );
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const preloadResponse = event.preloadResponse && await event.preloadResponse;
          if (preloadResponse) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(event.request, preloadResponse.clone());
            return preloadResponse;
          }
          
          const networkResponse = await fetch(event.request);
          if (networkResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        } catch (error) {
          const cache = await caches.open(CACHE_NAME);
          const cachedResponse = await cache.match(event.request);
          if (cachedResponse) {
            return cachedResponse;
          }
          const offlineResponse = await cache.match(OFFLINE_URL);
          if (offlineResponse) {
            return offlineResponse;
          }
          return new Response(
            '<!DOCTYPE html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline</title><style>body{font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f8fafc;color:#334155}div{text-align:center;padding:2rem}h1{font-size:1.5rem;margin-bottom:1rem}p{color:#64748b}</style></head><body><div><h1>Brak połączenia</h1><p>Spróbuj ponownie po przywróceniu połączenia z internetem.</p></div></body></html>',
            {
              status: 503,
              headers: { "Content-Type": "text/html; charset=utf-8" },
            }
          );
        }
      })()
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      const cachedResponse = await cache.match(event.request);
      if (cachedResponse) {
        return cachedResponse;
      }
      try {
        const networkResponse = await fetch(event.request);
        if (networkResponse.ok && !url.pathname.startsWith("/_next/data/")) {
          cache.put(event.request, networkResponse.clone());
        }
        return networkResponse;
      } catch (error) {
        return new Response("", { status: 408 });
      }
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "skipWaiting") {
    self.skipWaiting();
  }
});
