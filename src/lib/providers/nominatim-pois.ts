import "server-only";
import { z } from "zod";
import { fetchJson, USER_AGENT } from "./http";
import type { CitySeed, PlaceSeed } from "@/lib/data/schemas";
import { toPlace } from "./pois/osm";
import type { NearbyRequest } from "./nearby";
import { classifyVenue, distanceMeters, foodVenueKinds, pickVenues, venueCompleteness, venueHints, type Venue } from "@/lib/nearby/schema";

/**
 * Nominatim as a stand-in for Overpass. The public Overpass instances refuse
 * or stall connections from cloud hosting (Vercel), while Nominatim answers
 * from anywhere. Its "special phrase" search ("[museum]" inside a bounding
 * box) returns the same OSM objects with tags in `extratags`, so results are
 * mapped to the exact shape Overpass elements have and go through the same
 * classification. Usage policy: at most one request per second, which is why
 * the queries are sequential and paced; results are cached like every provider.
 */
const NOMINATIM = process.env.NOMINATIM_URL || "https://nominatim.openstreetmap.org";
const PAUSE_MS = 1_100;

const resultSchema = z.array(
  z.object({
    osm_type: z.string(),
    osm_id: z.number(),
    lat: z.string(),
    lon: z.string(),
    name: z.string().optional(),
    display_name: z.string(),
    category: z.string().optional(),
    type: z.string().optional(),
    extratags: z.record(z.string(), z.string()).optional().nullable(),
    namedetails: z.record(z.string(), z.string()).optional().nullable(),
  }),
);
type Result = z.infer<typeof resultSchema>[number];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const osmType = { node: "node", way: "way", relation: "relation" } as Record<string, string>;

/** Overpass-shaped element from a Nominatim hit: tags = extratags + names + the class/type pair. */
function toElement(r: Result) {
  const tags: Record<string, string> = { ...(r.extratags ?? {}) };
  for (const [k, v] of Object.entries(r.namedetails ?? {})) tags[k] = v;
  if (!tags.name && r.name) tags.name = r.name;
  if (r.category && r.type) tags[r.category] = r.type;
  return { type: osmType[r.osm_type] ?? r.osm_type, id: r.osm_id, lat: Number(r.lat), lon: Number(r.lon), tags };
}

async function search(phrase: string, box: { s: number; w: number; n: number; e: number }, limit = 50): Promise<Result[]> {
  const params = new URLSearchParams({
    q: `[${phrase}]`,
    viewbox: `${box.w},${box.n},${box.e},${box.s}`,
    bounded: "1",
    format: "jsonv2",
    limit: String(limit),
    extratags: "1",
    namedetails: "1",
    "accept-language": "en",
  });
  const url = `${NOMINATIM}/search?${params}`;
  return fetchJson(url, { provider: "nominatim", schema: resultSchema, timeoutMs: 15_000, cacheKey: url, ttlMs: 24 * 60 * 60 * 1000, init: { headers: { "User-Agent": USER_AGENT } } });
}

/** Attractions for a city area through Nominatim's category search: one query per category, paced. */
export async function nominatimPlacesForCity(city: CitySeed, notes?: string[]): Promise<PlaceSeed[]> {
  const [s, w, n, e] = city.bbox;
  const box = { s, w, n, e };
  const phrases = ["museum", "castle", "palace", "monument", "viewpoint", "park", "garden", "church", "cathedral", "zoo", "aquarium", "theme park", "attraction", "ruins", "beach", "market", "tower", "bridge"];
  const out = new Map<string, PlaceSeed>();
  let failures = 0;
  for (const phrase of phrases) {
    try {
      const hits = await search(phrase, box);
      for (const r of hits) {
        const place = toPlace(toElement(r), city);
        if (place && !out.has(place.externalId ?? place.id)) out.set(place.externalId ?? place.id, place);
      }
    } catch {
      failures += 1;
    }
    await sleep(PAUSE_MS);
  }
  if (failures) notes?.push(`nominatim: ${failures} of ${phrases.length} category searches failed for ${city.slug}`);
  return [...out.values()];
}

/** Restaurants and evening venues around points, a bounded box per request; capped so a plan stays inside its time budget. */
export async function nominatimVenues(requests: NearbyRequest[], limit = 6, maxQueries = 10): Promise<Record<string, Venue[]>> {
  const out: Record<string, Venue[]> = {};
  let queries = 0;
  for (const r of requests) {
    if (queries >= maxQueries) break;
    const dLat = r.radiusM / 111_000;
    const dLng = r.radiusM / (111_000 * Math.cos((r.lat * Math.PI) / 180));
    const box = { s: r.lat - dLat, n: r.lat + dLat, w: r.lng - dLng, e: r.lng + dLng };
    const phrases = r.group === "food" ? ["restaurant"] : r.kinds?.includes("nightclub") ? ["bar", "nightclub"] : r.kinds?.includes("theatre") ? ["theatre", "cinema"] : ["viewpoint", "cafe"];
    const list: { venue: Venue; score: number }[] = [];
    for (const phrase of phrases) {
      if (queries >= maxQueries) break;
      queries += 1;
      try {
        for (const hit of await search(phrase, box, 30)) {
          const el = toElement(hit);
          const kind = classifyVenue(el.tags);
          if (!kind || !el.tags.name) continue;
          const isFood = foodVenueKinds.includes(kind);
          if (r.group === "food" && !isFood) continue;
          if (r.group === "evening" && isFood && kind !== "ice_cream" && kind !== "cafe") continue;
          if (r.kinds && !r.kinds.includes(kind)) continue;
          const distanceM = distanceMeters(r, { lat: el.lat, lng: el.lon });
          if (distanceM > r.radiusM) continue;
          list.push({
            venue: {
              id: `${el.type}/${el.id}`,
              name: el.tags.name,
              kind,
              cuisine: el.tags.cuisine ? el.tags.cuisine.split(";")[0].replace(/_/g, " ") : null,
              lat: el.lat,
              lng: el.lon,
              distanceM,
              openingHours: el.tags.opening_hours ?? null,
              website: el.tags.website ?? el.tags["contact:website"] ?? null,
              wikidata: el.tags.wikidata ?? null,
              hints: venueHints(el.tags),
            },
            score: venueCompleteness(el.tags),
          });
        }
      } catch {
        // Best effort: the section stays empty for this point.
      }
      await sleep(PAUSE_MS);
    }
    out[r.key] = pickVenues(list, limit);
  }
  return out;
}
