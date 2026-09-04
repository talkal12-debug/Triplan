import "server-only";
import { getSeedCities, getSeedPlaces } from "@/lib/data/pois";
import type { CitySeed, PlaceSeed } from "@/lib/data/schemas";
import type { PoiProvider } from "../types";

/** The curated demo destinations shipped with the repo. Works offline. */
export const seedPois: PoiProvider = {
  name: "seed",
  async searchCities(countryCode: string, query: string, locale: string): Promise<CitySeed[]> {
    const q = query.trim().toLowerCase();
    return getSeedCities(countryCode).filter((c) => !q || Object.values(c.names).some((n) => n.toLowerCase().includes(q)) || c.names[locale]?.toLowerCase().includes(q));
  },
  async placesForCity(city: CitySeed): Promise<PlaceSeed[]> {
    return getSeedPlaces(city.countryCode, city.slug);
  },
};
