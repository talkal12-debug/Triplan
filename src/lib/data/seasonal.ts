import { z } from "zod";
import seasonalJson from "../../../data/seasonal.json";

/**
 * Seasonal highlights (festivals, blossoms, markets, crowd warnings) for the
 * demo destinations, matched against the trip's dates. Curated with a source per
 * entry; exact dates move every year, so the UI always says "check the official site".
 */
export const seasonalItemSchema = z.object({
  id: z.string(),
  countryCode: z.string().length(2),
  /** City slugs, or null for the whole country. */
  cities: z.array(z.string()).nullable(),
  kind: z.enum(["festival", "nature", "market", "caution"]),
  /** MM-DD; `to` may be before `from` when the window crosses New Year. */
  from: z.string().regex(/^\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{2}-\d{2}$/),
  peak: z.string().regex(/^\d{2}-\d{2}$/).optional(),
  names: z.record(z.string(), z.string()),
  description: z.record(z.string(), z.string()),
  url: z.string().url(),
});
export type SeasonalItem = z.infer<typeof seasonalItemSchema>;

export const seasonalItems: readonly SeasonalItem[] = z.object({ items: z.array(seasonalItemSchema) }).parse(seasonalJson).items;

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Does the MM-DD window include this ISO date? Windows may wrap around New Year. */
export function windowIncludes(item: Pick<SeasonalItem, "from" | "to">, isoDate: string): boolean {
  const md = isoDate.slice(5);
  return item.from <= item.to ? md >= item.from && md <= item.to : md >= item.from || md <= item.to;
}

/** Items that overlap the trip in any of its countries / cities, with the first overlapping date. */
export function seasonalFor(destinations: { countryCode: string; cities: string[] }[], start: string, days: number): (SeasonalItem & { firstDate: string })[] {
  const out: (SeasonalItem & { firstDate: string })[] = [];
  const dates = Array.from({ length: Math.max(1, days) }, (_, i) => addDays(start, i));
  for (const item of seasonalItems) {
    const dest = destinations.find((d) => d.countryCode.toUpperCase() === item.countryCode);
    if (!dest) continue;
    if (item.cities && dest.cities.length > 0 && !item.cities.some((c) => dest.cities.includes(c))) continue;
    const firstDate = dates.find((d) => windowIncludes(item, d));
    if (firstDate) out.push({ ...item, firstDate });
  }
  return out.sort((a, b) => a.firstDate.localeCompare(b.firstDate));
}

/** Text in the UI language, English otherwise. */
export function seasonalText(map: Record<string, string>, locale: string): string {
  return map[locale] ?? map.en ?? Object.values(map)[0] ?? "";
}
