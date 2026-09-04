"use client";

import type { GuestPlan } from "@/lib/guest/trips";

/**
 * Pre-caches the map for a plan: the style, sprites and the vector tiles around every
 * day's stops at zooms 12-14, into the same cache the service worker serves from.
 * Only works when a service worker controls the page (production build).
 */
export const MAP_CACHE = "triplan-map";
const STYLES = ["https://tiles.openfreemap.org/styles/liberty", "https://tiles.openfreemap.org/styles/fiord"];
const ZOOMS = [12, 13, 14];
const PAD = 0.01; // ~1 km around the stops

export function canCacheOffline(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "caches" in window && Boolean(navigator.serviceWorker.controller);
}

function lon2tile(lon: number, z: number) {
  return Math.floor(((lon + 180) / 360) * 2 ** z);
}
function lat2tile(lat: number, z: number) {
  const r = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z);
}

/** Tile URLs for the bounding boxes of every day. */
export function tileUrlsFor(plan: GuestPlan, template: string): string[] {
  const urls = new Set<string>();
  for (const day of plan.itinerary.days) {
    const pts = day.activities.map((a) => (a.placeId ? plan.places[a.placeId] : undefined)).filter((p): p is NonNullable<typeof p> => Boolean(p));
    const stay = plan.itinerary.stays.find((s) => s.id === day.stayId);
    const lats = [...pts.map((p) => p.lat), ...(stay ? [stay.center.lat] : [])];
    const lngs = [...pts.map((p) => p.lng), ...(stay ? [stay.center.lng] : [])];
    if (lats.length === 0) continue;
    const s = Math.min(...lats) - PAD;
    const n = Math.max(...lats) + PAD;
    const w = Math.min(...lngs) - PAD;
    const e = Math.max(...lngs) + PAD;
    for (const z of ZOOMS) {
      const x0 = lon2tile(w, z);
      const x1 = lon2tile(e, z);
      const y0 = lat2tile(n, z);
      const y1 = lat2tile(s, z);
      if ((x1 - x0 + 1) * (y1 - y0 + 1) > 400) continue; // too wide: skip this zoom for this day
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) urls.add(template.replace("{z}", String(z)).replace("{x}", String(x)).replace("{y}", String(y)));
    }
  }
  return [...urls];
}

export async function precacheMap(plan: GuestPlan, onProgress?: (done: number, total: number) => void): Promise<{ tiles: number }> {
  const cache = await caches.open(MAP_CACHE);
  // Style + tilejson + sprites for both themes.
  let template: string | null = null;
  for (const styleUrl of STYLES) {
    const res = await fetch(styleUrl);
    if (!res.ok) continue;
    await cache.put(styleUrl, res.clone());
    const style = (await res.json()) as { sources?: Record<string, { url?: string }>; sprite?: string };
    for (const src of Object.values(style.sources ?? {})) {
      if (!src.url) continue;
      const tj = await fetch(src.url);
      if (!tj.ok) continue;
      await cache.put(src.url, tj.clone());
      const json = (await tj.json()) as { tiles?: string[] };
      template ??= json.tiles?.[0] ?? null;
    }
    if (style.sprite) {
      for (const suffix of [".json", ".png", "@2x.json", "@2x.png"]) {
        const r = await fetch(`${style.sprite}${suffix}`).catch(() => null);
        if (r?.ok) await cache.put(`${style.sprite}${suffix}`, r);
      }
    }
  }
  if (!template) throw new Error("no tile template");

  const urls = tileUrlsFor(plan, template);
  let done = 0;
  const workers = Array.from({ length: 6 }, async () => {
    while (urls.length) {
      const url = urls.shift()!;
      try {
        if (!(await cache.match(url))) {
          const res = await fetch(url);
          if (res.ok) await cache.put(url, res);
        }
      } catch {
        // skip a failed tile; the rest still helps
      }
      done += 1;
      onProgress?.(done, done + urls.length);
    }
  });
  await Promise.all(workers);
  return { tiles: done };
}
