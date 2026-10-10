import "server-only";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { poisFileSchema, type CitySeed, type PlaceSeed, type PoisFile } from "./schemas";
import { dropDuplicatePlaces } from "@/lib/providers/pois/osm-core";

/**
 * The prebuilt world catalogue (data/world/{cc}.json): for a few hundred
 * tourist cities outside the hand-curated demo countries, attractions were
 * fetched once from OpenStreetMap, ranked with Wikidata, described with
 * Wikipedia, and committed (scripts/build-world.ts). At plan time they are read
 * from disk, which is what makes a plan for Paris as fast as one for Lisbon.
 * One file per country, loaded lazily and kept in memory for the process.
 */
const worldDir = join(process.cwd(), "data", "world");

const cache = new Map<string, PoisFile | null>();
const heDir = join(process.cwd(), "data", "world-he");

/**
 * Hebrew written by Claude at dev time (scripts/world/he-todo.mts, he-apply.mts): names for places
 * with no Hebrew name in OSM or Wikidata, and translations of the English Wikipedia lead for the top
 * places of each city, marked translatedFrom "en". Kept apart from data/world so a rebuild keeps them.
 * Descriptions found to be about something else (the architect of a bridge) are dropped in every language.
 */
function withHebrew(code: string, places: PlaceSeed[], cities: CitySeed[]): PlaceSeed[] {
  const file = join(heDir, `${code.toLowerCase()}.json`);
  if (!existsSync(file)) return places;
  const he = JSON.parse(readFileSync(file, "utf8")) as { names?: Record<string, string>; summaries?: Record<string, string>; wrongSummaries?: string[] };
  const wrong = new Set(he.wrongSummaries ?? []);
  // OSM sometimes tags an attraction with its city's Hebrew name (Doha's Museum of Islamic Art as "דוחה"):
  // a written name replaces that.
  const cityHe = new Map(cities.map((c) => [c.slug, c.names.he]));
  return places.map((p) => {
    if (wrong.has(p.id)) p = { ...p, summary: undefined };
    const name = !p.names.he || p.names.he === cityHe.get(p.city) ? he.names?.[p.id] : undefined;
    const text = !p.summary?.he && p.summary?.en ? he.summaries?.[p.id] : undefined;
    if (!name && !text) return p;
    return {
      ...p,
      names: name ? { ...p.names, he: name } : p.names,
      summary: text ? { ...p.summary, he: { text, url: p.summary!.en.url, translatedFrom: "en", image: p.summary!.en.image } } : p.summary,
    };
  });
}

function load(countryCode: string): PoisFile | null {
  const code = countryCode.toUpperCase();
  if (cache.has(code)) return cache.get(code)!;
  const file = join(worldDir, `${code.toLowerCase()}.json`);
  let data: PoisFile | null = null;
  if (existsSync(file)) {
    const parsed = poisFileSchema.safeParse(JSON.parse(readFileSync(file, "utf8")));
    // Files built before the duplicate rule still carry a few twins; drop them on load.
    data = parsed.success ? { ...parsed.data, places: withHebrew(code, dropDuplicatePlaces(parsed.data.places), parsed.data.cities) } : null;
  }
  cache.set(code, data);
  return data;
}

export function worldCountryCodes(): string[] {
  if (!existsSync(worldDir)) return [];
  return readdirSync(worldDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(".json", "").toUpperCase());
}

export function hasWorldCountry(countryCode: string): boolean {
  return load(countryCode) !== null;
}

export function getWorldCities(countryCode: string): CitySeed[] {
  return load(countryCode)?.cities ?? [];
}

export function getWorldCity(countryCode: string, slug: string): CitySeed | undefined {
  return getWorldCities(countryCode).find((c) => c.slug === slug);
}

export function getWorldPlaces(countryCode: string, slug?: string): PlaceSeed[] {
  const places = load(countryCode)?.places ?? [];
  return slug ? places.filter((p) => p.city === slug) : places;
}
