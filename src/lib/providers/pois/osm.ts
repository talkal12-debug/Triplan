import "server-only";
import { z } from "zod";
import { fetchJson, USER_AGENT } from "../http";
import type { PoiProvider } from "../types";
import { citySeedSchema, placeSeedSchema, type CitySeed, type PlaceCategory, type PlaceSeed, type PlaceTag } from "@/lib/data/schemas";

/**
 * OpenStreetMap as a POI source for every country without a curated seed:
 *  - Nominatim finds cities/areas (with a bounding box)
 *  - Overpass lists attractions inside the box
 * Everything is marked "partial" (coordinates real, editorial fields heuristic)
 * or "verified" when OSM also has opening hours. Nothing is invented.
 */

const NOMINATIM = process.env.NOMINATIM_URL || "https://nominatim.openstreetmap.org";
const OVERPASS = process.env.OVERPASS_URL || "https://overpass-api.de/api/interpreter";
const WIKIDATA = "https://www.wikidata.org/w/api.php";

/** Bump when classification / ranking changes so cached cities are refetched. */
export const OSM_PROVIDER_VERSION = 3;

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

export function slugify(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/** Cap a city's bounding box so Overpass queries stay small (~25 km across). */
function clampBox(box: [number, number, number, number], center: { lat: number; lng: number }): [number, number, number, number] {
  const maxLat = 0.12;
  const maxLng = 0.16;
  const [s, w, n, e] = box;
  return [Math.max(s, center.lat - maxLat), Math.max(w, center.lng - maxLng), Math.min(n, center.lat + maxLat), Math.min(e, center.lng + maxLng)];
}

/** Category + editorial defaults from OSM tags. Returns null for things we do not plan around. */
export function classify(tags: Record<string, string>): { category: PlaceCategory; tags: PlaceTag[]; visitMinutes: number; indoor: boolean; kidFriendly: boolean } | null {
  const t = tags;
  const has = (k: string, v?: string) => (v ? t[k] === v : Boolean(t[k]));
  const wiki = Boolean(t.wikidata || t.wikipedia);
  if (has("tourism", "museum")) return { category: "museum", tags: ["museums", "history"], visitMinutes: 90, indoor: true, kidFriendly: true };
  if (has("tourism", "gallery")) return { category: "gallery", tags: ["art", "museums"], visitMinutes: 75, indoor: true, kidFriendly: false };
  if (has("tourism", "zoo")) return { category: "zoo", tags: ["kids", "nature", "attractions"], visitMinutes: 150, indoor: false, kidFriendly: true };
  if (has("tourism", "aquarium")) return { category: "aquarium", tags: ["kids", "nature", "attractions"], visitMinutes: 90, indoor: true, kidFriendly: true };
  if (has("tourism", "theme_park")) return { category: "theme_park", tags: ["kids", "adventure", "attractions"], visitMinutes: 300, indoor: false, kidFriendly: true };
  if (has("tourism", "viewpoint")) return { category: "viewpoint", tags: ["views", "photography", "free"], visitMinutes: 20, indoor: false, kidFriendly: true };
  if (has("historic", "castle") || has("castle_type")) return { category: "castle", tags: ["history", "views"], visitMinutes: 90, indoor: false, kidFriendly: true };
  if (has("historic", "palace") || has("building", "palace")) return { category: "palace", tags: ["history", "architecture"], visitMinutes: 75, indoor: true, kidFriendly: false };
  // Memorial plaques are everywhere in OSM and almost never worth a stop.
  if (has("historic", "memorial")) return null;
  if (has("historic", "monument")) return { category: "monument", tags: ["history", "photography", "free"], visitMinutes: 20, indoor: false, kidFriendly: true };
  if (has("historic", "ruins") || has("historic", "archaeological_site")) return { category: "landmark", tags: ["history", "walking"], visitMinutes: 60, indoor: false, kidFriendly: true };
  if (has("amenity", "place_of_worship")) {
    const religion = t.religion;
    const category: PlaceCategory = religion === "shinto" ? "shrine" : religion === "buddhist" || religion === "hindu" ? "temple" : "church";
    const extra: PlaceTag[] = religion === "jewish" ? ["jewish"] : [];
    return { category, tags: ["religion", "history", "architecture", ...extra], visitMinutes: 30, indoor: true, kidFriendly: true };
  }
  if (has("leisure", "park") || has("leisure", "garden")) return { category: has("leisure", "garden") ? "garden" : "park", tags: ["nature", "kids", "free", "walking"], visitMinutes: 60, indoor: false, kidFriendly: true };
  if (has("natural", "beach")) return { category: "beach", tags: ["beaches", "nature", "free", "kids"], visitMinutes: 120, indoor: false, kidFriendly: true };
  if (has("amenity", "marketplace")) return { category: "market", tags: ["food", "local", "shopping"], visitMinutes: 45, indoor: false, kidFriendly: true };
  if (has("man_made", "tower") && wiki) return { category: "tower", tags: ["views", "architecture", "attractions"], visitMinutes: 45, indoor: false, kidFriendly: true };
  if (has("man_made", "bridge") && wiki) return { category: "bridge", tags: ["architecture", "photography", "free"], visitMinutes: 20, indoor: false, kidFriendly: true };
  if (has("place", "square") && wiki) return { category: "square", tags: ["city", "free", "walking"], visitMinutes: 20, indoor: false, kidFriendly: true };
  if (has("tourism", "attraction")) return { category: "landmark", tags: ["iconic", "photography"], visitMinutes: 45, indoor: false, kidFriendly: true };
  return null;
}

function iconicityOf(tags: Record<string, string>): number {
  if (tags.wikipedia && tags.wikidata) return 0.7;
  if (tags.wikidata) return 0.5;
  return 0.3;
}

/** Notability from the number of Wikipedia language editions: 0 links -> 0.3, ~40 -> 0.86, 150+ -> 1. */
export function iconicityFromSitelinks(sitelinks: number): number {
  return Math.min(1, Math.round((0.3 + 0.35 * Math.log10(1 + sitelinks)) * 100) / 100);
}

const wikidataSchema = z.object({
  entities: z.record(
    z.string(),
    z.object({
      sitelinks: z.record(z.string(), z.unknown()).optional(),
      labels: z.record(z.string(), z.object({ value: z.string() })).optional(),
    }),
  ),
});

export type WikidataFacts = { sitelinks: number; labels: Record<string, string> };

/** Sitelink counts and labels (he, en, ...) for a batch of Wikidata ids, 50 per request. */
export async function wikidataFacts(ids: string[], languages = ["he", "en", "ar", "ru", "es", "fr", "de", "it", "pt", "ja"]): Promise<Map<string, WikidataFacts>> {
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

/** Apply Wikidata notability and labels to places that have a wikidata id. */
export function enrichWithWikidata(places: PlaceSeed[], facts: Map<string, WikidataFacts>): PlaceSeed[] {
  return places.map((p) => {
    const f = p.wikidata ? facts.get(p.wikidata) : undefined;
    if (!f) return p;
    const names = { ...p.names };
    for (const [lang, label] of Object.entries(f.labels)) {
      if (!names[lang]) names[lang] = label;
    }
    return { ...p, names, iconicity: iconicityFromSitelinks(f.sitelinks) };
  });
}

export function toPlace(el: { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }, city: CitySeed): PlaceSeed | null {
  const tags = el.tags ?? {};
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  const name = tags.name;
  if (lat === undefined || lng === undefined || !name) return null;
  const cls = classify(tags);
  if (!cls) return null;
  const en = tags["name:en"] ?? name;
  const he = tags["name:he"];
  const names: { en: string; local: string; [k: string]: string } = { en, local: name };
  if (he) names.he = he;
  for (const l of ["ar", "ru", "es", "fr", "de", "it", "pt", "ja"]) if (tags[`name:${l}`]) names[l] = tags[`name:${l}`];
  const openingHours = tags.opening_hours?.trim() || null;
  const wheelchair = tags.wheelchair === "yes" || tags.wheelchair === "limited" || tags.wheelchair === "no" ? tags.wheelchair : "unknown";
  const website = (tags.website ?? tags["contact:website"] ?? "").split(";")[0].trim();
  let siteUrl: string | null = null;
  if (website) {
    try {
      siteUrl = new URL(website.startsWith("http") ? website : `https://${website}`).toString();
    } catch {
      siteUrl = null;
    }
  }
  const place: PlaceSeed = {
    id: `${city.countryCode.toLowerCase()}-${city.slug}-${slugify(name) || "place"}-${el.id}`,
    externalId: `osm:${el.type}:${el.id}`,
    countryCode: city.countryCode,
    city: city.slug,
    nameLocal: name,
    names,
    category: cls.category,
    tags: cls.tags,
    lat,
    lng,
    elevationM: null,
    openingHours,
    closedDates: [],
    visitMinutes: cls.visitMinutes,
    iconicity: iconicityOf(tags),
    minAge: null,
    wheelchair,
    strollerOk: null,
    priceLevel: tags.fee === "no" ? 0 : tags.fee === "yes" ? 1 : null,
    website: siteUrl,
    ticketUrl: null,
    requiresAdvanceBooking: false,
    indoor: cls.indoor,
    kidFriendly: cls.kidFriendly,
    dataQuality: openingHours ? "verified" : "partial",
    source: "osm",
    wikidata: tags.wikidata && /^Q\d+$/.test(tags.wikidata) ? tags.wikidata : null,
  };
  const parsed = placeSeedSchema.safeParse(place);
  return parsed.success ? parsed.data : null;
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
    const [s, w, n, e] = city.bbox;
    const box = `${s},${w},${n},${e}`;
    // Tier 1: anything notable enough to have a Wikipedia article. Tier 2: museums and the
    // like even without one. Two queries keep Overpass fast and stop plaques crowding out icons.
    const tier1 = `[out:json][timeout:40];
(
  nwr["tourism"~"^(museum|gallery|zoo|aquarium|theme_park|viewpoint|attraction)$"]["name"]["wikipedia"](${box});
  nwr["historic"~"^(castle|palace|monument|ruins|archaeological_site)$"]["name"]["wikipedia"](${box});
  nwr["amenity"="place_of_worship"]["name"]["wikipedia"](${box});
  nwr["leisure"~"^(park|garden)$"]["name"]["wikipedia"](${box});
  nwr["natural"="beach"]["name"](${box});
  nwr["amenity"="marketplace"]["name"](${box});
  nwr["man_made"~"^(tower|bridge)$"]["name"]["wikipedia"](${box});
  nwr["place"="square"]["name"]["wikipedia"](${box});
);
out center tags 1500;`;
    const tier2 = `[out:json][timeout:40];
(
  nwr["tourism"~"^(museum|gallery|zoo|aquarium|theme_park|viewpoint)$"]["name"][!"wikipedia"](${box});
  nwr["historic"~"^(castle|palace)$"]["name"][!"wikipedia"](${box});
);
out center tags 400;`;
    const run = (query: string, tier: number) =>
      fetchJson(OVERPASS, {
        provider: "overpass",
        schema: overpassSchema,
        timeoutMs: 50_000,
        cacheKey: `overpass:${city.slug}:${tier}:${OSM_PROVIDER_VERSION}`,
        ttlMs: 6 * 60 * 60 * 1000,
        init: { method: "POST", body: `data=${encodeURIComponent(query)}`, headers: { "Content-Type": "application/x-www-form-urlencoded" } },
      });
    const [a, b] = await Promise.all([run(tier1, 1), run(tier2, 2).catch(() => ({ elements: [] }))]);
    const raw = [...a.elements, ...b.elements].map((el) => toPlace(el, city)).filter((p): p is PlaceSeed => p !== null);

    // Wikidata: notability (sitelinks) and Hebrew names. Failure just keeps the tag-based scores.
    let places = raw;
    try {
      const facts = await wikidataFacts(raw.map((p) => p.wikidata).filter((id): id is string => Boolean(id)));
      places = enrichWithWikidata(raw, facts);
    } catch {
      places = raw;
    }

    const seen = new Set<string>();
    return places
      .sort((a, b) => b.iconicity - a.iconicity || (b.openingHours ? 1 : 0) - (a.openingHours ? 1 : 0))
      .filter((p) => {
        const key = `${p.externalId}`;
        const nameKey = p.nameLocal.toLowerCase();
        if (seen.has(key) || seen.has(nameKey)) return false;
        seen.add(key);
        seen.add(nameKey);
        return true;
      })
      .slice(0, 80);
  },
};
