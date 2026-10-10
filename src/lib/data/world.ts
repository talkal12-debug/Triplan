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

function load(countryCode: string): PoisFile | null {
  const code = countryCode.toUpperCase();
  if (cache.has(code)) return cache.get(code)!;
  const file = join(worldDir, `${code.toLowerCase()}.json`);
  let data: PoisFile | null = null;
  if (existsSync(file)) {
    const parsed = poisFileSchema.safeParse(JSON.parse(readFileSync(file, "utf8")));
    // Files built before the duplicate rule still carry a few twins; drop them on load.
    data = parsed.success ? { ...parsed.data, places: dropDuplicatePlaces(parsed.data.places) } : null;
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
