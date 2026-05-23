// Service worker kill-switch.
//
// This file replaces the previous Workbox-generated service worker that was
// installed by vite-plugin-pwa. Returning users still have the old SW
// registered at this scope; when their browser fetches /sw.js it will
// install THIS version, which claims all clients, clears every cache, then
// unregisters itself so no further fetches are intercepted.
//
// Keep this file in place for at least one full release cycle before
// deleting — any device that hasn't visited the site since the cleanup
// shipped still has the old SW and needs this file served on next load.
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    try {
      await self.clients.claim();
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));
      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      // Force a one-shot reload with a cache-bust query so the browser
      // fetches the latest HTML/JS without the old SW serving cached copies.
      await Promise.all(clients.map((client) => {
        try {
          const url = new URL(client.url);
          url.searchParams.set("sw-cleanup", Date.now().toString());
          return client.navigate(url.toString());
        } catch {
          return Promise.resolve();
        }
      }));
      await self.registration.unregister();
    } catch (e) {
      // best-effort cleanup
    }
  })());
});

// Pass through any fetches while the cleanup is in flight (don't intercept).
self.addEventListener("fetch", () => {});