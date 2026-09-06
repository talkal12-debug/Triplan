import "server-only";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { distanceMeters, foodVenueKinds, pickVenues, venueKinds, type Venue } from "@/lib/nearby/schema";
import type { NearbyRequest } from "@/lib/providers/nearby";

/**
 * Venues shipped with the app for the demo destinations (data/venues/{cc}.json,
 * built by `npm run data:venues` from OpenStreetMap around every curated
 * attraction). The live site cannot reach the public Overpass servers, and the
 * demo cities are where most plans are built, so these answer instantly.
 */
const fileSchema = z.object({
  version: z.number(),
  generatedAt: z.string(),
  source: z.string(),
  venues: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      kind: z.enum(venueKinds),
      cuisine: z.string().nullable(),
      lat: z.number(),
      lng: z.number(),
      openingHours: z.string().nullable(),
      website: z.string().nullable(),
      wikidata: z.string().nullable(),
      hints: z.array(z.enum(["outdoor", "wheelchair", "vegetarian", "live_music", "wine", "family"])),
      score: z.number(),
    }),
  ),
});
type StoredVenue = z.infer<typeof fileSchema>["venues"][number];

const cache = new Map<string, StoredVenue[] | null>();

function load(countryCode: string): StoredVenue[] | null {
  const cc = countryCode.toLowerCase();
  if (cache.has(cc)) return cache.get(cc)!;
  const file = join(process.cwd(), "data", "venues", `${cc}.json`);
  const parsed = existsSync(file) ? fileSchema.safeParse(JSON.parse(readFileSync(file, "utf8"))) : null;
  const venues = parsed?.success ? parsed.data.venues : null;
  cache.set(cc, venues);
  return venues;
}

export function hasLocalVenues(countryCode: string): boolean {
  return load(countryCode) !== null;
}

/** Same contract as nearbyVenues(), answered from the shipped file. */
export function localVenues(requests: NearbyRequest[], limit = 6): Record<string, Venue[]> {
  const out: Record<string, Venue[]> = {};
  for (const r of requests) {
    const all = load(r.countryCode) ?? [];
    const list: { venue: Venue; score: number }[] = [];
    for (const v of all) {
      const distanceM = distanceMeters(r, v);
      if (distanceM > r.radiusM) continue;
      const isFood = foodVenueKinds.includes(v.kind);
      if (r.group === "food" && !isFood) continue;
      if (r.group === "evening" && isFood && v.kind !== "ice_cream" && v.kind !== "cafe") continue;
      if (r.kinds && !r.kinds.includes(v.kind)) continue;
      const { score, ...rest } = v;
      list.push({ venue: { ...rest, distanceM }, score });
    }
    out[r.key] = pickVenues(list, limit);
  }
  return out;
}
