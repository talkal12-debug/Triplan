import { placeSeedSchema, type CitySeed, type PlaceSeed } from "@/lib/data/schemas";
import type { MustVisit } from "@/lib/planner/types";
import { distanceMeters } from "./schema";

/**
 * Pure helpers for the wishlist (no server-only import, so unit tests and the
 * suggest route can use them): name normalisation, catalogue matching and the
 * synthetic catalogue entry for a place we only know from the traveller.
 */
export const normalizeName = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/["'’`.,()\-–/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Catalogue place whose name (in any language) contains the query or vice versa. */
export function matchPlaceByName(name: string, places: PlaceSeed[]): PlaceSeed | null {
  const q = normalizeName(name);
  if (q.length < 3) return null;
  let best: { place: PlaceSeed; score: number } | null = null;
  for (const p of places) {
    const candidates = [p.nameLocal, ...Object.values(p.names)].map(normalizeName);
    for (const c of candidates) {
      let score = 0;
      if (c === q) score = 3;
      else if (c.includes(q) || q.includes(c)) score = 2 - Math.abs(c.length - q.length) / 100;
      if (score > (best?.score ?? 0)) best = { place: p, score };
    }
  }
  return best && best.score >= 1 ? best.place : null;
}

function slug(s: string): string {
  return normalizeName(s).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "place";
}

function nearestCity(cities: CitySeed[], point: { lat: number; lng: number }): CitySeed {
  return cities.reduce((a, b) => (distanceMeters(b.center, point) < distanceMeters(a.center, point) ? b : a));
}

/** A catalogue entry for a wished place we only know from the traveller / OSM: marked unverified, one hour, iconic for scoring. */
export function syntheticPlace(entry: MustVisit, point: { lat: number; lng: number }, cities: CitySeed[], extra: { wikidata?: string | null; website?: string | null; nameEn?: string } = {}): PlaceSeed | null {
  const city = nearestCity(cities, point);
  const nameEn = extra.nameEn?.trim() || entry.name.trim();
  const candidate = {
    id: `${city.countryCode.toLowerCase()}-wish-${slug(entry.name)}`,
    externalId: null,
    countryCode: city.countryCode,
    city: city.slug,
    nameLocal: entry.name.trim(),
    names: { en: nameEn, he: entry.name.trim(), local: entry.name.trim() },
    category: "landmark" as const,
    tags: ["iconic" as const],
    lat: point.lat,
    lng: point.lng,
    elevationM: null,
    openingHours: null,
    closedDates: [],
    visitMinutes: 60,
    iconicity: 0.8,
    minAge: null,
    wheelchair: "unknown" as const,
    strollerOk: null,
    priceLevel: null,
    website: extra.website && /^https?:\/\//.test(extra.website) ? extra.website : null,
    ticketUrl: null,
    requiresAdvanceBooking: false,
    indoor: false,
    kidFriendly: true,
    dataQuality: "unverified" as const,
    source: "user" as const,
    wikidata: extra.wikidata && /^Q\d+$/.test(extra.wikidata) ? extra.wikidata : null,
  };
  const parsed = placeSeedSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

