import "server-only";
import countriesJson from "../../../data/countries.json";
import extrasJson from "../../../data/country-extras.json";
import { countriesFileSchema, countryExtrasFileSchema, type Country, type CountryExtras } from "./schemas";
import type { Locale } from "@/lib/i18n/locales";

/**
 * Static country data, validated once at module load. Lives in the bundle,
 * so it works offline, at build time, and without a database.
 */
export const countries: readonly Country[] = countriesFileSchema.parse(countriesJson);

const byCode = new Map(countries.map((c) => [c.code, c]));

const extras: readonly CountryExtras[] = countryExtrasFileSchema.parse(extrasJson);
const extrasByCode = new Map(extras.map((e) => [e.code, e]));

/** Destinations with a full, hand-checked POI seed. Everything else is "basic facts only". */
export const demoCountryCodes = ["PT", "IT", "JP"] as const;

export function isDemoCountry(code: string): boolean {
  return (demoCountryCodes as readonly string[]).includes(code.toUpperCase());
}

export function getCountry(code: string): Country | undefined {
  return byCode.get(code.toUpperCase());
}

export function getCountryExtras(code: string): CountryExtras | undefined {
  return extrasByCode.get(code.toUpperCase());
}

/** Name in the UI language, falling back to English. */
export function countryName(country: Country, locale: Locale): string {
  return country.names[locale] ?? country.names.en;
}

/**
 * "Hebrew name / local name" pair for display, e.g. "פורטוגל / Portugal".
 * Returns only one part when they are identical.
 */
export function countryDisplayName(country: Country, locale: Locale): string {
  const localized = countryName(country, locale);
  const local = country.names.local;
  return local && local !== localized ? `${localized} / ${local}` : localized;
}
