import "server-only";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { poisFileSchema, type CitySeed, type PlaceSeed, type PoisFile } from "./schemas";

/**
 * Read access to the committed POI seed files (data/pois/*.json).
 * Used at build time and by the seed script; runtime queries go through Prisma.
 */
const poisDir = join(process.cwd(), "data", "pois");

let cache: Map<string, PoisFile> | undefined;

function loadAll(): Map<string, PoisFile> {
  if (cache) return cache;
  cache = new Map();
  for (const file of readdirSync(poisDir).filter((f) => f.endsWith(".json"))) {
    const code = file.replace(".json", "").toUpperCase();
    cache.set(code, poisFileSchema.parse(JSON.parse(readFileSync(join(poisDir, file), "utf8"))));
  }
  return cache;
}

export function getSeededCountryCodes(): string[] {
  return [...loadAll().keys()];
}

export function getSeedCities(countryCode: string): CitySeed[] {
  return loadAll().get(countryCode.toUpperCase())?.cities ?? [];
}

export function getSeedPlaces(countryCode: string, city?: string): PlaceSeed[] {
  const places = loadAll().get(countryCode.toUpperCase())?.places ?? [];
  return city ? places.filter((p) => p.city === city) : places;
}
