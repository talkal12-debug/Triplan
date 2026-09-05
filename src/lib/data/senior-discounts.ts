import { z } from "zod";
import json from "../../../data/senior-discounts.json";

/**
 * Where travellers aged 65+ pay less (milestone 12). Curated per country and
 * per place for the demo destinations, each with the source it was read from.
 * Shown only when the party includes someone 65+, always with "confirm with ID".
 */
const noteSchema = z.record(z.string(), z.string());
const fileSchema = z.object({
  countries: z.array(z.object({ countryCode: z.string().length(2), note: noteSchema, url: z.string().url() })),
  places: z.record(z.string(), z.object({ note: noteSchema, url: z.string().url() })),
});
const data = fileSchema.parse(json);

export type SeniorInfo = {
  countries: { countryCode: string; note: Record<string, string>; url: string }[];
  places: Record<string, { note: Record<string, string>; url: string }>;
};

/** Country rules for the trip's countries and place notes for the given place ids; null when nothing applies. */
export function seniorInfoFor(countryCodes: string[], placeIds: string[]): SeniorInfo | null {
  const codes = new Set(countryCodes.map((c) => c.toUpperCase()));
  const countries = data.countries.filter((c) => codes.has(c.countryCode));
  const places: SeniorInfo["places"] = {};
  for (const id of placeIds) if (data.places[id]) places[id] = data.places[id];
  if (countries.length === 0 && Object.keys(places).length === 0) return null;
  return { countries, places };
}

export function seniorText(map: Record<string, string>, locale: string): string {
  return map[locale] ?? map.en ?? Object.values(map)[0] ?? "";
}
