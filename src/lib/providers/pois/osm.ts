import "server-only";
import { z } from "zod";
import { fetchJson, USER_AGENT } from "../http";
import { overpassQuery } from "../overpass";
import { nominatimPlacesForCity } from "../nominatim-pois";
import type { PoiProvider } from "../types";
import { citySeedSchema, type CitySeed, type PlaceSeed } from "@/lib/data/schemas";
import {
  OSM_PROVIDER_VERSION,
  WIKIDATA_LANGUAGES,
  clampBox,
  enrichWithWikidata,
  overpassQueriesFor,
  overpassSchema,
  selectPlaces,
  slugify,
  toPlace,
  wikidataSchema,
  type WikidataFacts,
} from "./osm-core";

/**
 * OpenStreetMap as a POI source for every country without a curated seed:
 *  - Nominatim finds cities/areas (with a bounding box)
 *  - Overpass lists attractions inside the box
 * Everything is marked "partial" (coordinates real, editorial fields heuristic)
 * or "verified" when OSM also has opening hours. Nothing is invented.
 * The pure parts (classification, ranking) live in osm-core.ts and are shared
 * with the offline world build.
 */

const NOMINATIM = process.env.NOMINATIM_URL || "https://nominatim.openstreetmap.org";
const WIKIDATA = "https://www.wikidata.org/w/api.php";

export { OSM_PROVIDER_VERSION, classify, enrichWithWikidata, iconicityFromSitelinks, slugify, toPlace, type WikidataFacts } from "./osm-core";

const nominatimSchema = z.array(
  z.object({
    osm_type: z.string(),
    osm_id: z.number(),
    lat: z.string(),
    lon: z.string(),
    name: z.string().optional(),
    display_name: z.string(),
    addresstype: z.string().optional(),
    importance: z.number().optional(),
    boundingbox: z.tuple([z.string(), z.string(), z.string(), z.string()]),
    namedetails: z.record(z.string(), z.string()).optional(),
  }),
);

/** Sitelink counts and labels (he, en, ...) for a batch of Wikidata ids, 50 per request. */
export async function wikidataFacts(ids: string[], languages: string[] = WIKIDATA_LANGUAGES): Promise<Map<string, WikidataFacts>> {
  const out = new Map<string, WikidataFacts>();
  const unique = [...new Set(ids)];
  for (let i = 0; i < unique.length; i += 50) {
    const batch = unique.slice(i, i + 50);
    const url = `${WIKIDATA}?action=wbgetentities&ids=${batch.join("|")}&props=sitelinks|labels&languages=${languages.join("|")}&format=json`;
    const data = await fetchJson(url, { provider: "wikidata", schema: wikidataSchema, cacheKey: url, ttlMs: 30 * 24 * 60 * 60 * 1000 });
    for (const [id, e] of Object.entries(data.entities)) {
      const labels: Record<string, string> = {};
      for (const [lang, l] of Object.entries(e.labels ?? {})) labels[lang] = l.value;
      out.set(id, { sitelinks: Object.keys(e.sitelinks ?? {}).length, labels });
    }
  }
  return out;
}

export const osmPois: PoiProvider = {
  name: "osm",

  async searchCities(countryCode: string, query: string, locale: string): Promise<CitySeed[]> {
    const params = new URLSearchParams({
      q: query,
      countrycodes: countryCode.toLowerCase(),
      format: "jsonv2",
      limit: "6",
      namedetails: "1",
      "accept-language": `${locale},en`,
    });
    const url = `${NOMINATIM}/search?${params}`;
    const data = await fetchJson(url, {
      provider: "nominatim",
      schema: nominatimSchema,
      cacheKey: url,
      ttlMs: 24 * 60 * 60 * 1000,
      init: { headers: { "User-Agent": USER_AGENT } },
    });
    const wanted = new Set(["city", "town", "village", "municipality", "island", "county", "state_district", "region", "suburb", "borough"]);
    const out: CitySeed[] = [];
    for (const r of data) {
      if (r.addresstype && !wanted.has(r.addresstype)) continue;
      const center = { lat: Number(r.lat), lng: Number(r.lon) };
      const [s, n, w, e] = r.boundingbox.map(Number);
      const local = r.namedetails?.name ?? r.name ?? r.display_name.split(",")[0];
      const names: { en: string; local: string; [k: string]: string } = { en: r.namedetails?.["name:en"] ?? local, local };
      if (r.namedetails?.["name:he"]) names.he = r.namedetails["name:he"];
      else if (locale === "he" && r.name && r.name !== local) names.he = r.name;
      const city = {
        slug: `osm-${slugify(local)}-${r.osm_id}`,
        countryCode: countryCode.toUpperCase(),
        names,
        center,
        bbox: clampBox([s, w, n, e], center),
      };
      const parsed = citySeedSchema.safeParse(city);
      if (parsed.success) out.push(parsed.data);
    }
    return out;
  },

  async placesForCity(city: CitySeed): Promise<PlaceSeed[]> {
    // Tier 1: anything notable enough to have a Wikipedia article. Tier 2: museums and the
    // like even without one. Two queries keep Overpass fast and stop plaques crowding out icons.
    const { tier1, tier2 } = overpassQueriesFor(city.bbox);
    const run = (query: string, tier: number) =>
      overpassQuery(query, {
        provider: "overpass",
        schema: overpassSchema,
        // Short enough that the Nominatim fallback still fits in a serverless request when Overpass is unreachable.
        timeoutMs: 25_000,
        cacheKey: `overpass:${city.slug}:${tier}:${OSM_PROVIDER_VERSION}`,
        ttlMs: 6 * 60 * 60 * 1000,
      });
    let raw: PlaceSeed[];
    try {
      const [a, b] = await Promise.all([run(tier1, 1), run(tier2, 2).catch(() => ({ elements: [] }))]);
      raw = [...a.elements, ...b.elements].map((el) => toPlace(el, city)).filter((p): p is PlaceSeed => p !== null);
    } catch {
      // Overpass unreachable (it refuses cloud hosting): Nominatim's category search returns the same objects, slower.
      raw = await nominatimPlacesForCity(city);
      if (raw.length === 0) throw new Error("overpass unreachable and nominatim found nothing");
    }

    // Wikidata: notability (sitelinks) and names in every UI language. Failure just keeps the tag-based scores.
    let places = raw;
    try {
      const facts = await wikidataFacts(raw.map((p) => p.wikidata).filter((id): id is string => Boolean(id)));
      places = enrichWithWikidata(raw, facts);
    } catch {
      places = raw;
    }
    return selectPlaces(places, 80);
  },
};
