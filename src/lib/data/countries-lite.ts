import "server-only";
import { countries, countryName, isDemoCountry } from "./countries";
import { getSeedCities } from "./pois";
import type { Locale } from "@/lib/i18n/locales";

/** Small, serialisable country record for client components (wizard, trip pages). */
export type CountryLite = {
  code: string;
  name: string;
  local: string | null;
  demo: boolean;
  drivingSide: "left" | "right";
  lat: number;
  /** English name when it differs from `name`, so search works in English too. */
  en: string | null;
};

export type CityLite = { slug: string; name: string; local: string | null; image?: { url: string; page: string | null } | null };

export function getCountriesLite(locale: Locale): CountryLite[] {
  const collator = new Intl.Collator(locale);
  return countries
    .map((c) => {
      const name = countryName(c, locale);
      return {
        code: c.code,
        name,
        local: c.names.local && c.names.local !== name ? c.names.local : null,
        demo: isDemoCountry(c.code),
        drivingSide: c.drivingSide,
        lat: c.lat,
        en: c.names.en !== name ? c.names.en : null,
      };
    })
    .sort((a, b) => Number(b.demo) - Number(a.demo) || collator.compare(a.name, b.name));
}

/** Cities/areas of the seeded (demo) countries, keyed by country code. */
export function getDemoCitiesLite(locale: Locale): Record<string, CityLite[]> {
  const out: Record<string, CityLite[]> = {};
  for (const c of countries) {
    if (!isDemoCountry(c.code)) continue;
    out[c.code] = getSeedCities(c.code).map((city) => {
      const name = city.names[locale] ?? city.names.en;
      return { slug: city.slug, name, local: city.names.local && city.names.local !== name ? city.names.local : null, image: city.image ?? null };
    });
  }
  return out;
}
