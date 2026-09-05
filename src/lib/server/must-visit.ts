import "server-only";
import { z } from "zod";
import { fetchJson, USER_AGENT } from "@/lib/providers/http";
import type { CitySeed, PlaceSeed } from "@/lib/data/schemas";
import type { MustVisit, TripPreferences } from "@/lib/planner/types";
import { matchPlaceByName, syntheticPlace } from "@/lib/nearby/must-visit-core";

export { matchPlaceByName, normalizeName, syntheticPlace } from "@/lib/nearby/must-visit-core";

/**
 * The traveller's wishlist (milestone 11). Entries picked from our catalogue carry a
 * placeId; free-text entries are matched by name against the catalogue, then looked
 * up on OpenStreetMap (Nominatim) inside the trip's cities. A place we cannot find
 * is reported back, never guessed.
 */
const NOMINATIM = process.env.NOMINATIM_URL || "https://nominatim.openstreetmap.org";

const nominatimSchema = z.array(
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

type OsmHit = { point: { lat: number; lng: number }; wikidata: string | null; website: string | null; nameEn?: string; osmClass?: string; osmType?: string; openingHours?: string | null; description?: string };

const wikidataSearchSchema = z.object({ search: z.array(z.object({ id: z.string(), label: z.string().optional(), description: z.string().optional() })) });

/** A one-line description from Wikidata's search when OSM has no wikidata tag (e.g. "restaurant chain"), so the card can say what the place is. */
async function describeOnWikidata(name: string): Promise<string | null> {
  const url = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(name)}&language=en&limit=3&format=json`;
  const data = await fetchJson(url, { provider: "wikidata", schema: wikidataSearchSchema, cacheKey: url, ttlMs: 24 * 60 * 60 * 1000, init: { headers: { "User-Agent": USER_AGENT } } });
  const q = name.trim().toLowerCase();
  const hit = data.search.find((s) => s.label?.toLowerCase() === q && s.description);
  return hit?.description ? hit.description.charAt(0).toUpperCase() + hit.description.slice(1) : null;
}

async function lookupOnOsm(name: string, city: CitySeed): Promise<OsmHit | null> {
  const params = new URLSearchParams({
    q: `${name}, ${city.names.en}`,
    countrycodes: city.countryCode.toLowerCase(),
    format: "jsonv2",
    limit: "3",
    extratags: "1",
    namedetails: "1",
    "accept-language": "en",
  });
  const url = `${NOMINATIM}/search?${params}`;
  const data = await fetchJson(url, { provider: "nominatim", schema: nominatimSchema, cacheKey: url, ttlMs: 24 * 60 * 60 * 1000, init: { headers: { "User-Agent": USER_AGENT } } });
  const [s, w, n, e] = city.bbox;
  for (const r of data) {
    const point = { lat: Number(r.lat), lng: Number(r.lon) };
    // Must be inside (or just around) the chosen city, not a namesake elsewhere in the country.
    if (point.lat < s - 0.2 || point.lat > n + 0.2 || point.lng < w - 0.2 || point.lng > e + 0.2) continue;
    const hit: OsmHit = {
      point,
      wikidata: r.extratags?.wikidata ?? null,
      website: r.extratags?.website ?? null,
      nameEn: r.namedetails?.["name:en"] ?? r.name,
      osmClass: r.category,
      osmType: r.type,
      openingHours: r.extratags?.opening_hours ?? null,
    };
    if (!hit.wikidata) {
      try {
        hit.description = (await describeOnWikidata(name)) ?? undefined;
      } catch {
        // Optional: the card falls back to the category.
      }
    }
    return hit;
  }
  return null;
}

export type ResolvedMustVisit = {
  prefs: TripPreferences;
  /** Places to add to the catalogue for this plan (wishlist entries not in it). */
  added: PlaceSeed[];
  /** Names we could not place anywhere. */
  unresolved: string[];
};

export async function resolveMustVisit(prefs: TripPreferences, places: PlaceSeed[], cities: CitySeed[], notes?: string[]): Promise<ResolvedMustVisit> {
  const added: PlaceSeed[] = [];
  const unresolved: string[] = [];
  const known = new Map(places.map((p) => [p.id, p]));
  const out: MustVisit[] = [];
  for (const entry of prefs.mustVisit) {
    if (entry.placeId && known.has(entry.placeId)) {
      out.push(entry);
      continue;
    }
    const byName = matchPlaceByName(entry.name, places);
    if (byName) {
      out.push({ ...entry, placeId: byName.id });
      continue;
    }
    let point = entry.lat !== undefined && entry.lng !== undefined ? { lat: entry.lat, lng: entry.lng } : null;
    let extra: Partial<OsmHit> = {};
    if (!point && cities.length > 0) {
      try {
        const hit = await lookupOnOsm(entry.name, cities[0]);
        if (hit) {
          point = hit.point;
          extra = hit;
        }
      } catch {
        notes?.push(`nominatim: lookup failed for "${entry.name}"`);
      }
    }
    const place = point ? syntheticPlace(entry, point, cities, extra) : null;
    if (place) {
      if (!known.has(place.id)) {
        added.push(place);
        known.set(place.id, place);
      }
      out.push({ ...entry, placeId: place.id, lat: place.lat, lng: place.lng });
    } else {
      unresolved.push(entry.name);
    }
  }
  return { prefs: { ...prefs, mustVisit: out }, added, unresolved };
}
