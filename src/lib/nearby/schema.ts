import { z } from "zod";
import { affiliateLinkSchema } from "@/lib/providers/affiliate";
import { eveningStyles } from "@/lib/planner/types";

/**
 * Nearby suggestions (milestone 11): restaurants around each meal and evening
 * venues around the hotel, from OpenStreetMap; events on the trip's dates from
 * an events provider when a key is configured. Plain Zod, shared by the browser
 * (stored plan) and the server.
 */
export const venueKinds = ["restaurant", "cafe", "fast_food", "bar", "pub", "nightclub", "theatre", "cinema", "music", "arts", "casino", "viewpoint", "ice_cream"] as const;
export type VenueKind = (typeof venueKinds)[number];

export const venueSchema = z.object({
  /** OSM element id, e.g. "node/123". */
  id: z.string(),
  name: z.string(),
  kind: z.enum(venueKinds),
  cuisine: z.string().nullable(),
  lat: z.number(),
  lng: z.number(),
  /** Straight-line metres from the point the suggestion is for. */
  distanceM: z.number().int(),
  openingHours: z.string().nullable(),
  website: z.string().nullable(),
  wikidata: z.string().nullable(),
  /** Hints only: outdoor seating, wheelchair, vegetarian option, live music. */
  hints: z.array(z.enum(["outdoor", "wheelchair", "vegetarian", "live_music", "wine", "family"])),
});
export type Venue = z.infer<typeof venueSchema>;

export const eventSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string().url(),
  /** ISO date-time (local) or date. */
  start: z.string(),
  venue: z.string().nullable(),
  category: z.string().nullable(),
  source: z.string(),
  /** The seller's classification (Ticketmaster segment > genre > sub-genre), for the evening preference. */
  segment: z.string().nullable().optional(),
  genre: z.string().nullable().optional(),
  subGenre: z.string().nullable().optional(),
  /** Matches one of the traveller's preferred event kinds. */
  preferred: z.boolean().optional(),
  /** Ticket price range as published by the seller, when it says. */
  priceMin: z.number().nullable().optional(),
  priceMax: z.number().nullable().optional(),
  currency: z.string().nullable().optional(),
  image: z.string().url().nullable().optional(),
});
export type EventItem = z.infer<typeof eventSchema>;

/** One evening = dinner near the hotel, venues for the chosen style, real events (with a key) and search links. */
export const eveningSchema = z.object({
  style: z.enum(eveningStyles),
  center: z.object({ lat: z.number(), lng: z.number() }),
  dinner: z.array(venueSchema),
  venues: z.array(venueSchema),
  events: z.array(eventSchema),
  /** Which events provider answered; null = none configured. */
  eventsSource: z.string().nullable(),
  links: z.array(affiliateLinkSchema),
});
export type Evening = z.infer<typeof eveningSchema>;

/** Straight-line distance in metres. */
export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

/** OSM tags -> venue kind; null for things we do not suggest. */
export function classifyVenue(tags: Record<string, string>): VenueKind | null {
  const a = tags.amenity;
  if (a === "restaurant" || a === "food_court") return "restaurant";
  if (a === "cafe") return "cafe";
  if (a === "fast_food") return "fast_food";
  if (a === "ice_cream") return "ice_cream";
  if (a === "nightclub") return "nightclub";
  if (a === "bar" || a === "biergarten") return "bar";
  if (a === "pub") return "pub";
  if (a === "theatre") return "theatre";
  if (a === "cinema") return "cinema";
  if (a === "music_venue" || a === "concert_hall" || tags.club === "music") return "music";
  if (a === "arts_centre" || a === "events_venue") return "arts";
  if (a === "casino") return "casino";
  if (tags.tourism === "viewpoint") return "viewpoint";
  return null;
}

export function venueHints(tags: Record<string, string>): Venue["hints"] {
  const out: Venue["hints"] = [];
  if (tags.outdoor_seating === "yes") out.push("outdoor");
  if (tags.wheelchair === "yes") out.push("wheelchair");
  if (tags["diet:vegetarian"] === "yes" || tags["diet:vegan"] === "yes") out.push("vegetarian");
  if (tags.live_music === "yes") out.push("live_music");
  if (tags.bar === "wine_bar" || tags["drink:wine"] === "yes" || tags.cuisine?.includes("wine")) out.push("wine");
  if (tags.kids_area === "yes" || tags.highchair === "yes") out.push("family");
  return out;
}

/** How complete an OSM entry is: fuller entries are more likely real, open businesses. */
export function venueCompleteness(tags: Record<string, string>): number {
  let s = 0;
  if (tags.website || tags["contact:website"]) s += 1;
  if (tags.opening_hours) s += 1;
  if (tags.cuisine) s += 0.5;
  if (tags.wikidata) s += 2;
  if (tags.phone || tags["contact:phone"]) s += 0.5;
  return s;
}

export const foodVenueKinds: VenueKind[] = ["restaurant", "cafe", "fast_food", "ice_cream"];

/** Ranked by score then distance, capped, with no kind taking more than half the list when there are alternatives. */
export function pickVenues(list: { venue: Venue; score: number }[], limit: number): Venue[] {
  const sorted = [...list].sort((a, b) => b.score - a.score || a.venue.distanceM - b.venue.distanceM);
  const picked: Venue[] = [];
  const perKind = new Map<VenueKind, number>();
  for (const { venue } of sorted) {
    const n = perKind.get(venue.kind) ?? 0;
    if (n >= Math.max(2, Math.ceil(limit / 2)) && sorted.length > limit) continue;
    picked.push(venue);
    perKind.set(venue.kind, n + 1);
    if (picked.length >= limit) break;
  }
  return picked;
}

/** Venue kinds that fit each evening style. */
export const styleKinds: Record<(typeof eveningStyles)[number], VenueKind[]> = {
  quiet: ["viewpoint", "ice_cream", "bar", "pub", "cafe"],
  culture: ["theatre", "music", "arts", "cinema"],
  nightlife: ["nightclub", "bar", "pub", "music", "casino"],
  none: [],
};
