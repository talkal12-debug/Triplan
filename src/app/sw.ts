import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { CacheFirst, ExpirationPlugin, NetworkFirst, Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

/**
 * Offline strategy:
 *  - build assets: precached (Serwist manifest)
 *  - pages: network first, fall back to the cached copy, then to /offline
 *  - map style, sprites, glyphs and vector tiles: cache first (the "download for offline"
 *    button fills the same cache ahead of time)
 *  - flags and fonts: cache first
 */
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      matcher: ({ url }) => url.hostname === "tiles.openfreemap.org",
      handler: new CacheFirst({
        cacheName: "triplan-map",
        plugins: [new ExpirationPlugin({ maxEntries: 6000, maxAgeSeconds: 60 * 24 * 60 * 60, maxAgeFrom: "last-used" })],
      }),
    },
    {
      matcher: ({ url }) => url.hostname === "flagcdn.com",
      handler: new CacheFirst({ cacheName: "triplan-flags", plugins: [new ExpirationPlugin({ maxEntries: 400, maxAgeSeconds: 180 * 24 * 60 * 60 })] }),
    },
    {
      matcher: ({ request, url, sameOrigin }) => sameOrigin && request.mode === "navigate" && !url.pathname.startsWith("/api/"),
      handler: new NetworkFirst({
        cacheName: "triplan-pages",
        networkTimeoutSeconds: 4,
        plugins: [new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 30 * 24 * 60 * 60 })],
      }),
    },
    ...defaultCache,
  ],
  fallbacks: {
    entries: [{ url: "/offline", matcher: ({ request }) => request.destination === "document" }],
  },
});

serwist.addEventListeners();
