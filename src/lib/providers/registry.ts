import "server-only";
import { isDemoCountry } from "@/lib/data/countries";
import { getEnv } from "@/lib/env";
import type { CitySeed, PlaceSeed } from "@/lib/data/schemas";
import { tryProvider } from "./http";
import { estimateRouting } from "./routing/estimate";
import { osrmRouting } from "./routing/osrm";
import { openMeteo } from "./weather/open-meteo";
import { mockWeather } from "./weather/mock";
import { nagerDate } from "./holidays/nager";
import { mockHolidays } from "./holidays/mock";
import { frankfurter } from "./currency/frankfurter";
import { mockCurrency } from "./currency/mock";
import { seedPois } from "./pois/seed";
import { getWorldPlaces } from "@/lib/data/world";
import { osmPois } from "./pois/osm";
import { readCachedPlaces, writeCachedPlaces } from "./pois/cache";
import type { CurrencyProvider, HolidayProvider, PoiProvider, RoutingProvider, WeatherProvider } from "./types";

/**
 * Chooses providers by environment. TRIPLAN_OFFLINE=true forces every mock
 * (tests, demos without network). The free providers need no key; when one
 * fails at runtime the caller falls back to the mock result and notes it.
 */
function offline(): boolean {
  return getEnv().TRIPLAN_OFFLINE === "true";
}

export function getRouting(): RoutingProvider {
  return offline() ? estimateRouting : osrmRouting();
}

export function getWeather(): WeatherProvider {
  return offline() ? mockWeather : openMeteo;
}

export function getHolidays(): HolidayProvider {
  return offline() ? mockHolidays : nagerDate;
}

export function getCurrency(): CurrencyProvider {
  return offline() ? mockCurrency : frankfurter;
}

/** Curated seed for demo countries, OpenStreetMap (cached) for the rest. */
export function getPois(countryCode: string): PoiProvider {
  if (isDemoCountry(countryCode) || offline()) return seedPois;
  return osmPois;
}

/** Places for a city: the curated seed, then the prebuilt world catalogue, then the database cache, then live OpenStreetMap. */
export async function placesForCity(city: CitySeed, notes?: string[]): Promise<PlaceSeed[]> {
  const provider = getPois(city.countryCode);
  if (provider === seedPois) {
    const seeded = await seedPois.placesForCity(city);
    if (seeded.length > 0) return seeded;
  }
  const prebuilt = getWorldPlaces(city.countryCode, city.slug);
  if (prebuilt.length > 0) {
    notes?.push(`places: ${city.slug} from the world catalogue`);
    return prebuilt;
  }
  if (provider === seedPois) return [];
  const cached = await tryProvider("place-cache", () => readCachedPlaces(city), null, notes);
  if (cached && cached.length > 0) return cached;
  const fresh = await tryProvider("overpass", () => osmPois.placesForCity(city), [] as PlaceSeed[], notes);
  if (fresh.length > 0) await tryProvider("place-cache-write", () => writeCachedPlaces(fresh), undefined, notes);
  return fresh;
}

export { tryProvider };
