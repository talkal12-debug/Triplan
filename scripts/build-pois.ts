/**
 * Turns the curated POI lists (scripts/pois/*.ts) into data/pois/{cc}.json by
 * looking every place up on OpenStreetMap via Nominatim:
 *   - exact coordinates, OSM id, opening_hours, wheelchair, website, wikidata
 * Editorial fields (names, category, tags, iconicity, visit time) stay as curated.
 *
 * Nominatim usage policy: max 1 request/second, identifying User-Agent.
 * ~160 places => about 3 minutes. Output is committed, so this runs rarely.
 *
 * Usage: npm run data:pois                       (all countries)
 *        npm run data:pois -- PT                 (one country)
 *        npm run data:pois -- PT id-one,id-two   (re-resolve only these ids, merge into the file)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { placeSeedSchema, poisFileSchema, type PlaceSeed } from "../src/lib/data/schemas";
import type { CuratedCity, CuratedPoi } from "./pois/types";
import { portugal } from "./pois/portugal";
import { italy } from "./pois/italy";
import { japan } from "./pois/japan";

const UA = "Triplan-data-script/0.1 (talkal12@gmail.com)";
const MAX_MATCH_KM = 2.5;

const nominatimResult = z.object({
  osm_type: z.string(),
  osm_id: z.number(),
  lat: z.string(),
  lon: z.string(),
  display_name: z.string(),
  category: z.string().optional(),
  type: z.string().optional(),
  extratags: z.record(z.string(), z.string()).nullable().optional(),
});
type NominatimResult = z.infer<typeof nominatimResult>;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

async function nominatim(query: string, bbox: CuratedCity["bbox"]): Promise<NominatimResult[]> {
  const [s, w, n, e] = bbox;
  const params = new URLSearchParams({
    q: query,
    format: "jsonv2",
    extratags: "1",
    limit: "5",
    viewbox: `${w},${n},${e},${s}`,
    bounded: "1",
  });
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { "User-Agent": UA, "Accept-Language": "en" },
  });
  if (!res.ok) throw new Error(`Nominatim ${res.status} for "${query}"`);
  return z.array(nominatimResult).parse(await res.json());
}

function normalizeWheelchair(v: string | undefined): PlaceSeed["wheelchair"] {
  if (v === "yes" || v === "limited" || v === "no") return v;
  return "unknown";
}

function normalizeUrl(v: string | undefined): string | null {
  if (!v) return null;
  const url = v.split(";")[0].trim();
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).toString();
  } catch {
    return null;
  }
}

async function resolve(city: CuratedCity, poi: CuratedPoi): Promise<PlaceSeed> {
  let match: NominatimResult | undefined;
  try {
    const results = await nominatim(poi.q, city.bbox);
    const near = results
      .map((r) => ({ r, km: haversineKm(poi.approx, { lat: Number(r.lat), lng: Number(r.lon) }) }))
      .filter((x) => x.km <= MAX_MATCH_KM)
      .sort((a, b) => a.km - b.km);
    match = near[0]?.r;
  } catch (err) {
    console.warn(`  ! ${poi.id}: ${(err as Error).message}`);
  }

  const tags = match?.extratags ?? {};
  const osmHours = tags.opening_hours?.trim() || null;
  const openingHours = osmHours ?? poi.hoursFallback ?? null;

  let dataQuality: PlaceSeed["dataQuality"];
  if (match && osmHours) dataQuality = "verified";
  else if (match) dataQuality = "partial";
  else dataQuality = "unverified";

  const place: PlaceSeed = {
    id: `${city.countryCode.toLowerCase()}-${city.slug}-${poi.id}`,
    externalId: match ? `osm:${match.osm_type}:${match.osm_id}` : null,
    countryCode: city.countryCode,
    city: city.slug,
    nameLocal: poi.local,
    names: { en: poi.en, he: poi.he, local: poi.local },
    category: poi.category,
    tags: poi.tags,
    lat: match ? Number(match.lat) : poi.approx.lat,
    lng: match ? Number(match.lon) : poi.approx.lng,
    elevationM: null,
    openingHours,
    closedDates: [],
    visitMinutes: poi.visitMinutes,
    iconicity: poi.iconicity,
    minAge: poi.minAge ?? null,
    wheelchair: normalizeWheelchair(tags.wheelchair),
    strollerOk: poi.strollerOk ?? null,
    priceLevel: poi.priceLevel,
    website: normalizeUrl(tags.website ?? tags["contact:website"]),
    ticketUrl: null,
    requiresAdvanceBooking: poi.requiresAdvanceBooking ?? false,
    indoor: poi.indoor,
    kidFriendly: poi.kidFriendly,
    dataQuality,
    source: "seed",
    wikidata: tags.wikidata && /^Q\d+$/.test(tags.wikidata) ? tags.wikidata : null,
  };
  return placeSeedSchema.parse(place);
}

async function buildCountry(cities: CuratedCity[], onlyIds?: Set<string>) {
  const countryCode = cities[0].countryCode;
  const file = join(process.cwd(), "data", "pois", `${countryCode.toLowerCase()}.json`);
  // Partial mode: keep every place we are not asked to re-resolve.
  const existing = new Map<string, PlaceSeed>();
  if (onlyIds && existsSync(file)) {
    for (const p of poisFileSchema.parse(JSON.parse(readFileSync(file, "utf8"))).places) existing.set(p.id, p);
  }
  const places: PlaceSeed[] = [];
  const stats = { verified: 0, partial: 0, unverified: 0 };
  for (const city of cities) {
    console.log(`\n${city.names.en} (${city.pois.length} places)`);
    for (const poi of city.pois) {
      const fullId = `${countryCode.toLowerCase()}-${city.slug}-${poi.id}`;
      const kept = onlyIds && !onlyIds.has(poi.id) ? existing.get(fullId) : undefined;
      if (kept) {
        stats[kept.dataQuality] += 1;
        places.push(kept);
        continue;
      }
      const place = await resolve(city, poi);
      stats[place.dataQuality] += 1;
      const mark = place.dataQuality === "verified" ? "✓" : place.dataQuality === "partial" ? "~" : "✗";
      console.log(`  ${mark} ${place.id}${place.openingHours ? "" : "  (no hours)"}`);
      places.push(place);
      await sleep(1100);
    }
  }
  const ids = new Set(places.map((p) => p.id));
  if (ids.size !== places.length) throw new Error("duplicate place ids");

  const out = {
    generatedAt: new Date().toISOString(),
    attribution: "Coordinates and opening hours © OpenStreetMap contributors (ODbL). Editorial data © Triplan.",
    cities: cities.map(({ slug, countryCode, names, center, bbox }) => ({ slug, countryCode, names, center, bbox })),
    places,
  };
  mkdirSync(join(process.cwd(), "data", "pois"), { recursive: true });
  writeFileSync(file, JSON.stringify(out, null, 2) + "\n");
  console.log(`\n${countryCode}: ${places.length} places -> ${file}`);
  console.log(`   verified ${stats.verified}, partial ${stats.partial}, unverified ${stats.unverified}`);
}

async function main() {
  const only = process.argv[2]?.toUpperCase();
  const onlyIds = process.argv[3] ? new Set(process.argv[3].split(",")) : undefined;
  const all: Record<string, CuratedCity[]> = { PT: portugal, IT: italy, JP: japan };
  for (const [code, cities] of Object.entries(all)) {
    if (only && only !== code) continue;
    await buildCountry(cities, onlyIds);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
