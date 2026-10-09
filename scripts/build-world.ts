/**
 * Builds the world catalogue: data/world/{cc}.json for the cities listed in
 * scripts/world/cities.ts. For every city:
 *   1. Nominatim resolves the city (centre, bounding box, names per language)
 *   2. Overpass lists the attractions in the box (same queries as the live provider)
 *   3. Wikidata adds notability (language editions) and labels in the UI languages
 *   4. the best ~80 are kept (shared ranking), then Wikipedia descriptions and photos
 *
 * Rate limits of the volunteer services are respected: Nominatim 1 request/s,
 * Overpass one query at a time with pauses, Wikipedia paced by the summaries core.
 * The run is resumable: cities already in the file are skipped unless --refresh.
 *
 * Usage: npm run data:world                 (every city not built yet)
 *        npm run data:world -- FR ES        (countries)
 *        npm run data:world -- --only=paris,nice
 *        npm run data:world -- FR --refresh (rebuild)
 *        npm run data:world -- --no-summaries
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { citySeedSchema, poisFileSchema, type CitySeed, type PlaceSeed, type PoisFile } from "../src/lib/data/schemas";
import { clampBox, enrichWithWikidata, overpassQueriesFor, overpassSchema, selectPlaces, slugify, toPlace, wikidataSchema, WIKIDATA_LANGUAGES, type OverpassElement, type WikidataFacts } from "../src/lib/providers/pois/osm-core";
import { fetchPageImage, fetchSummariesBulk } from "../src/lib/providers/summaries-core";
import { worldCities, type WorldCitySpec } from "./world/cities";
import { GEOFABRIK, countryIndex, elementsInBox } from "./world/pbf";

const UA = "Triplan-world-build/0.1 (talkal12@gmail.com)";
const OUT = join(process.cwd(), "data", "world");
// A private instance (OVERPASS_URL, see docs/overpass.md) goes first and is the only one tried when OVERPASS_ONLY=1.
const PUBLIC_OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter", "https://overpass.private.coffee/api/interpreter", "https://overpass.osm.jp/api/interpreter"];
const OVERPASS = process.env.OVERPASS_URL ? (process.env.OVERPASS_ONLY ? [process.env.OVERPASS_URL] : [process.env.OVERPASS_URL, ...PUBLIC_OVERPASS]) : PUBLIC_OVERPASS;
const PAUSE_MS = process.env.OVERPASS_URL ? 200 : 2_000;
const PLACES_PER_CITY = 80;
const LANGS = ["he", "en"];
const ATTRIBUTION = "OpenStreetMap contributors (ODbL), Wikidata (CC0), Wikipedia (CC BY-SA)";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const args = process.argv.slice(2);
const refresh = args.includes("--refresh");
// --refresh-small=N rebuilds cities that ended up with fewer than N places (tiny OSM boxes before the minimum area).
const refreshSmall = Number(args.find((a) => a.startsWith("--refresh-small="))?.slice(16) ?? 0);
// --recheck re-resolves every existing city and rebuilds those whose centre moved by more than 3 km
// (cities built before resolution preferred the settlement over a province of the same name).
const recheck = args.includes("--recheck");
const noSummaries = args.includes("--no-summaries");
const only = args.find((a) => a.startsWith("--only="))?.slice(7).split(",").map((s) => s.trim()).filter(Boolean);
// --source=pbf (default): Geofabrik country files, scanned locally. --source=overpass: the public servers.
const source = args.find((a) => a.startsWith("--source="))?.slice(9) ?? "pbf";
const countries = args.filter((a) => /^[A-Za-z]{2}$/.test(a)).map((a) => a.toUpperCase());

// ---- Nominatim: the city itself ---------------------------------------------------------
const nominatimSchema = z.array(
  z.object({
    osm_id: z.number(),
    lat: z.string(),
    lon: z.string(),
    name: z.string().optional(),
    display_name: z.string(),
    addresstype: z.string().optional(),
    importance: z.number().optional(),
    boundingbox: z.tuple([z.string(), z.string(), z.string(), z.string()]),
    namedetails: z.record(z.string(), z.string()).optional(),
    extratags: z.record(z.string(), z.string()).optional().nullable(),
  }),
);
let lastNominatim = 0;
async function resolveCity(spec: WorldCitySpec): Promise<CitySeed | null> {
  const wait = 1100 - (Date.now() - lastNominatim);
  if (wait > 0) await sleep(wait);
  lastNominatim = Date.now();
  const params = new URLSearchParams({ q: spec.q ?? spec.en, countrycodes: spec.cc.toLowerCase(), format: "jsonv2", limit: "5", namedetails: "1", extratags: "1", "accept-language": "en" });
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`nominatim HTTP ${res.status}`);
  const hits = nominatimSchema.parse(await res.json());
  // Prefer the settlement itself: "Matera" is also a province, whose centre is 25 km away. Islands and
  // larger areas only when no settlement matches ("Lake Como", "Cinque Terre", "Bali").
  const settlements = ["city", "town", "municipality", "village"];
  const areas = ["island", "archipelago", "islet", "county", "state_district", "region", "state"];
  const preference = spec.area ? [...areas, ...settlements, "borough", "suburb"] : [...settlements, ...areas.slice(0, 3), "borough", "suburb", ...areas.slice(3)];
  const rank = (h: (typeof hits)[number]) => {
    const i = preference.indexOf(h.addresstype ?? "");
    return i < 0 ? preference.length : i;
  };
  const hit = [...hits].sort((a, b) => rank(a) - rank(b))[0];
  if (!hit) return null;
  const center = { lat: Number(hit.lat), lng: Number(hit.lon) };
  const [s, n, w, e] = hit.boundingbox.map(Number);
  const local = hit.namedetails?.name ?? hit.name ?? hit.display_name.split(",")[0];
  const names: { en: string; local: string; [k: string]: string } = { en: hit.namedetails?.["name:en"] ?? spec.en, local };
  for (const l of ["he", "ar", "ru", "es", "fr", "de", "it", "pt", "ja", "hi"]) if (hit.namedetails?.[`name:${l}`]) names[l] = hit.namedetails[`name:${l}`];
  if (hit.namedetails?.["name:zh"]) names["zh-CN"] = hit.namedetails["name:zh"];
  // Small towns get tiny boxes from OSM (Amalfi is 4 x 5 km) and the coast or valley around them is the point:
  // every city covers at least ~13 x 13 km around its centre, at most ~25 x 25 km (clampBox).
  const minLat = 0.06;
  const minLng = 0.06 / Math.max(0.3, Math.cos((center.lat * Math.PI) / 180));
  const widened: [number, number, number, number] = [Math.min(s, center.lat - minLat), Math.min(w, center.lng - minLng), Math.max(n, center.lat + minLat), Math.max(e, center.lng + minLng)];
  const city = { slug: slugify(spec.en), countryCode: spec.cc, names, center, bbox: clampBox(widened, center) };
  const parsed = citySeedSchema.safeParse(city);
  return parsed.success ? parsed.data : null;
}

function kmBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

// ---- Overpass: the attractions ------------------------------------------------------------
async function overpass(query: string): Promise<OverpassElement[]> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    for (const url of OVERPASS) {
      try {
        const res = await fetch(url, { method: "POST", body: `data=${encodeURIComponent(query)}`, headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": UA }, signal: AbortSignal.timeout(130_000) });
        if (res.status === 429 || res.status === 504) {
          lastErr = new Error(`HTTP ${res.status} from ${url}`);
          await sleep(10_000);
          continue;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return overpassSchema.parse(await res.json()).elements;
      } catch (err) {
        lastErr = err;
        console.log(`    ${url.replace("https://", "").split("/")[0]}: ${(err as Error).message.slice(0, 60)}`);
        await sleep(3_000);
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("overpass failed");
}

/** Both tiers for a box; a box that times out is split in four (twice at most). Big-city boxes are split up front: the whole box rarely answers. */
async function elementsFor(bbox: [number, number, number, number], depth = 0): Promise<OverpassElement[]> {
  const [s0, w0, n0, e0] = bbox;
  const big = depth === 0 && (n0 - s0 > 0.16 || e0 - w0 > 0.2);
  const { tier1, tier2 } = overpassQueriesFor(bbox, 90);
  try {
    if (big) throw new Error("large box, splitting up front");
    const a = await overpass(tier1);
    await sleep(PAUSE_MS);
    const b = await overpass(tier2).catch(() => [] as OverpassElement[]);
    return [...a, ...b];
  } catch (err) {
    if (depth >= 2) throw err;
    const [s, w, n, e] = bbox;
    const midLat = (s + n) / 2;
    const midLng = (w + e) / 2;
    console.log(`    splitting the box (${(err as Error).message.slice(0, 60)})`);
    const quads: [number, number, number, number][] = [
      [s, w, midLat, midLng],
      [s, midLng, midLat, e],
      [midLat, w, n, midLng],
      [midLat, midLng, n, e],
    ];
    const out: OverpassElement[] = [];
    for (const q of quads) {
      out.push(...(await elementsFor(q, depth + 1)));
      await sleep(2_000);
    }
    return out;
  }
}

// ---- Wikidata: notability + labels ------------------------------------------------------
async function wikidataFacts(ids: string[]): Promise<Map<string, WikidataFacts>> {
  const out = new Map<string, WikidataFacts>();
  const unique = [...new Set(ids)];
  for (let i = 0; i < unique.length; i += 50) {
    const batch = unique.slice(i, i + 50);
    const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${batch.join("|")}&props=sitelinks|labels&languages=${WIKIDATA_LANGUAGES.join("|")}&format=json`;
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) throw new Error(`wikidata HTTP ${res.status}`);
    const data = wikidataSchema.parse(await res.json());
    for (const [id, e] of Object.entries(data.entities)) {
      const labels: Record<string, string> = {};
      for (const [lang, l] of Object.entries(e.labels ?? {})) labels[lang] = l.value;
      out.set(id, { sitelinks: Object.keys(e.sitelinks ?? {}).length, labels });
    }
    await sleep(500);
  }
  return out;
}

// ---- Files --------------------------------------------------------------------------------
function readCountry(cc: string): PoisFile {
  const file = join(OUT, `${cc.toLowerCase()}.json`);
  if (!existsSync(file)) return { generatedAt: new Date().toISOString().slice(0, 10), attribution: ATTRIBUTION, cities: [], places: [] };
  return poisFileSchema.parse(JSON.parse(readFileSync(file, "utf8")));
}
function writeCountry(cc: string, data: PoisFile) {
  mkdirSync(OUT, { recursive: true });
  data.generatedAt = new Date().toISOString().slice(0, 10);
  data.attribution = ATTRIBUTION;
  data.cities.sort((a, b) => a.slug.localeCompare(b.slug));
  data.places.sort((a, b) => a.city.localeCompare(b.city) || b.iconicity - a.iconicity);
  writeFileSync(join(OUT, `${cc.toLowerCase()}.json`), JSON.stringify(data) + "\n");
}

const indexes = new Map<string, OverpassElement[]>();
async function elementsForCity(cc: string, bbox: [number, number, number, number]): Promise<OverpassElement[]> {
  if (source === "pbf" && GEOFABRIK[cc]) {
    if (!indexes.has(cc)) indexes.set(cc, await countryIndex(cc, (m) => console.log(m)));
    return elementsInBox(indexes.get(cc)!, bbox);
  }
  return elementsFor(bbox);
}

async function buildCity(spec: WorldCitySpec, data: PoisFile): Promise<boolean> {
  const slug = slugify(spec.en);
  const existing = data.places.filter((p) => p.city === slug).length;
  const built = data.cities.find((c) => c.slug === slug);
  let city: CitySeed | null = null;
  if (!refresh && built && !(refreshSmall && existing < refreshSmall)) {
    if (!recheck) return false;
    city = await resolveCity(spec);
    if (!city || kmBetween(city.center, built.center) <= 3) return false;
    console.log(`${spec.cc} ${spec.en}: moved ${kmBetween(city.center, built.center).toFixed(1)} km, rebuilding`);
  }
  process.stdout.write(`${spec.cc} ${spec.en}: `);
  city = city ?? (await resolveCity(spec));
  if (!city) {
    console.log("not found on Nominatim, skipped");
    return false;
  }
  const elements = await elementsForCity(spec.cc, city.bbox);
  const raw = elements.map((el) => toPlace(el, city)).filter((p): p is PlaceSeed => p !== null);
  let places = raw;
  try {
    places = enrichWithWikidata(raw, await wikidataFacts(raw.map((p) => p.wikidata).filter((id): id is string => Boolean(id))));
  } catch (err) {
    console.log(`(wikidata failed: ${(err as Error).message.slice(0, 50)}) `);
  }
  const chosen = selectPlaces(places, PLACES_PER_CITY);
  if (!noSummaries) {
    const todo = chosen.filter((p) => p.wikidata).map((p) => ({ id: p.id, wikidata: p.wikidata!, locales: LANGS }));
    const got = await fetchSummariesBulk(todo);
    for (const p of chosen) {
      const s = got.get(p.id);
      if (s && Object.keys(s).length) p.summary = s;
    }
    city.image = (await fetchPageImage("en", city.names.en).catch(() => null)) ?? (city.names.local ? await fetchPageImage("en", city.names.local).catch(() => null) : null);
  }
  data.cities = [...data.cities.filter((c) => c.slug !== slug), city];
  data.places = [...data.places.filter((p) => p.city !== slug), ...chosen];
  const withHours = chosen.filter((p) => p.openingHours).length;
  const withText = chosen.filter((p) => p.summary?.he || p.summary?.en).length;
  console.log(`${raw.length} found, ${chosen.length} kept (${withHours} with hours, ${withText} described)`);
  return true;
}

async function main() {
  // Countries named on the command line are built in that order (the list order otherwise).
  const specs = worldCities
    .filter((s) => (countries.length ? countries.includes(s.cc) : true) && (only ? only.includes(slugify(s.en)) : true))
    .sort((a, b) => (countries.length ? countries.indexOf(a.cc) - countries.indexOf(b.cc) : 0));
  const byCountry = new Map<string, WorldCitySpec[]>();
  for (const s of specs) byCountry.set(s.cc, [...(byCountry.get(s.cc) ?? []), s]);
  const started = Date.now();
  let built = 0;
  for (const [cc, list] of byCountry) {
    const data = readCountry(cc);
    for (const spec of list) {
      try {
        if (await buildCity(spec, data)) {
          built++;
          writeCountry(cc, data);
          await sleep(3_000);
        }
      } catch (err) {
        console.log(`FAILED: ${(err as Error).message.slice(0, 120)}`);
        await sleep(10_000);
      }
    }
  }
  console.log(`done: ${built} cities built in ${Math.round((Date.now() - started) / 60000)} min`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
