import "server-only";
import { z } from "zod";
import { fetchJson } from "./http";
import { classifyVenue, distanceMeters, venueHints, type Venue, type VenueKind } from "@/lib/nearby/schema";

/**
 * Venues around points, from OpenStreetMap (Overpass). One request per plan:
 * every point's "around" filter goes into a single union query, results are
 * assigned to the nearest requesting point. Nothing is invented: name,
 * coordinates, cuisine, opening hours and website are OSM's, unreviewed.
 */
const OVERPASS = process.env.OVERPASS_URL || "https://overpass-api.de/api/interpreter";
export const NEARBY_VERSION = 1;

export type NearbyRequest = {
  key: string;
  lat: number;
  lng: number;
  radiusM: number;
  group: "food" | "evening";
};

const overpassSchema = z.object({
  elements: z.array(
    z.object({
      type: z.string(),
      id: z.number(),
      lat: z.number().optional(),
      lon: z.number().optional(),
      center: z.object({ lat: z.number(), lon: z.number() }).optional(),
      tags: z.record(z.string(), z.string()).optional(),
    }),
  ),
});

const FOOD = `["amenity"~"^(restaurant|cafe|food_court|fast_food|ice_cream)$"]["name"]`;
const EVENING = `["amenity"~"^(bar|pub|biergarten|nightclub|theatre|cinema|music_venue|concert_hall|arts_centre|events_venue|casino|ice_cream)$"]["name"]`;
const VIEWPOINT = `["tourism"="viewpoint"]["name"]`;

const foodKinds: VenueKind[] = ["restaurant", "cafe", "fast_food", "ice_cream"];

/** How complete an OSM entry is: fuller entries are more likely real, open businesses. */
function completeness(tags: Record<string, string>): number {
  let s = 0;
  if (tags.website || tags["contact:website"]) s += 1;
  if (tags.opening_hours) s += 1;
  if (tags.cuisine) s += 0.5;
  if (tags.wikidata) s += 2;
  if (tags.phone || tags["contact:phone"]) s += 0.5;
  return s;
}

function toVenue(el: z.infer<typeof overpassSchema>["elements"][number], origin: { lat: number; lng: number }): Venue | null {
  const tags = el.tags ?? {};
  const kind = classifyVenue(tags);
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  if (!kind || !tags.name || lat === undefined || lng === undefined) return null;
  return {
    id: `${el.type}/${el.id}`,
    name: tags.name,
    kind,
    cuisine: tags.cuisine ? tags.cuisine.split(";")[0].replace(/_/g, " ") : null,
    lat,
    lng,
    distanceM: distanceMeters(origin, { lat, lng }),
    openingHours: tags.opening_hours ?? null,
    website: tags.website ?? tags["contact:website"] ?? null,
    wikidata: tags.wikidata ?? null,
    hints: venueHints(tags),
  };
}

/**
 * Venues per request key. Food requests get restaurants/cafes, evening requests
 * get bars/theatres/etc. plus viewpoints. Each list is ranked by completeness,
 * then distance, and capped at `limit`.
 */
export async function nearbyVenues(requests: NearbyRequest[], limit = 6): Promise<Record<string, Venue[]>> {
  const out: Record<string, Venue[]> = {};
  if (requests.length === 0) return out;
  const parts = requests.map((r) => {
    const around = `(around:${Math.round(r.radiusM)},${r.lat.toFixed(5)},${r.lng.toFixed(5)})`;
    return r.group === "food" ? `  nwr${FOOD}${around};` : `  nwr${EVENING}${around};\n  nwr${VIEWPOINT}${around};`;
  });
  const query = `[out:json][timeout:30];\n(\n${parts.join("\n")}\n);\nout center tags 600;`;
  const cacheKey = `nearby:${NEARBY_VERSION}:${requests.map((r) => `${r.group}${r.lat.toFixed(3)},${r.lng.toFixed(3)},${r.radiusM}`).join("|")}`;
  const data = await fetchJson(OVERPASS, {
    provider: "overpass-nearby",
    schema: overpassSchema,
    timeoutMs: 40_000,
    cacheKey,
    ttlMs: 12 * 60 * 60 * 1000,
    init: { method: "POST", body: `data=${encodeURIComponent(query)}`, headers: { "Content-Type": "application/x-www-form-urlencoded" } },
  });

  const scored = new Map<string, { venue: Venue; score: number }[]>();
  for (const el of data.elements) {
    const tags = el.tags ?? {};
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    if (lat === undefined || lng === undefined) continue;
    // Each element belongs to every request whose circle contains it and whose group wants it.
    for (const r of requests) {
      const v = toVenue(el, r);
      if (!v || v.distanceM > r.radiusM) continue;
      const isFood = foodKinds.includes(v.kind);
      if (r.group === "food" && !isFood) continue;
      if (r.group === "evening" && isFood && v.kind !== "ice_cream" && v.kind !== "cafe") continue;
      const list = scored.get(r.key) ?? [];
      list.push({ venue: v, score: completeness(tags) });
      scored.set(r.key, list);
    }
  }
  for (const r of requests) {
    const list = (scored.get(r.key) ?? []).sort((a, b) => b.score - a.score || a.venue.distanceM - b.venue.distanceM);
    // Keep variety: no more than half the list from one kind when there are alternatives.
    const picked: Venue[] = [];
    const perKind = new Map<VenueKind, number>();
    for (const { venue } of list) {
      const n = perKind.get(venue.kind) ?? 0;
      if (n >= Math.max(2, Math.ceil(limit / 2)) && list.length > limit) continue;
      picked.push(venue);
      perKind.set(venue.kind, n + 1);
      if (picked.length >= limit) break;
    }
    out[r.key] = picked;
  }
  return out;
}
