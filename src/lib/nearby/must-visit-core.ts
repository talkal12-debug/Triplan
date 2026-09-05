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

/** What kind of place an OSM class/type pair describes, so a wished restaurant is a meal and a wished park an hour outdoors. */
export function classifyOsmKind(cls: string | undefined, type: string | undefined): { category: PlaceSeed["category"]; tags: PlaceSeed["tags"]; visitMinutes: number; indoor: boolean } {
  const t = type ?? "";
  switch (cls) {
    case "amenity":
      if (["restaurant", "food_court", "biergarten"].includes(t)) return { category: "food", tags: ["food", "local"], visitMinutes: 75, indoor: true };
      if (["cafe", "ice_cream", "fast_food"].includes(t)) return { category: "food", tags: ["food", "local"], visitMinutes: 45, indoor: true };
      if (["bar", "pub", "nightclub"].includes(t)) return { category: "nightlife", tags: ["nightlife", "local"], visitMinutes: 90, indoor: true };
      if (["theatre", "cinema", "arts_centre"].includes(t)) return { category: "nightlife", tags: ["art", "nightlife"], visitMinutes: 150, indoor: true };
      if (t === "place_of_worship") return { category: "church", tags: ["religion", "architecture"], visitMinutes: 30, indoor: true };
      if (t === "marketplace") return { category: "market", tags: ["food", "local", "shopping"], visitMinutes: 45, indoor: false };
      break;
    case "tourism":
      if (t === "museum") return { category: "museum", tags: ["museums", "history"], visitMinutes: 90, indoor: true };
      if (t === "gallery") return { category: "gallery", tags: ["art", "museums"], visitMinutes: 60, indoor: true };
      if (t === "zoo") return { category: "zoo", tags: ["kids", "nature", "attractions"], visitMinutes: 150, indoor: false };
      if (t === "aquarium") return { category: "aquarium", tags: ["kids", "nature", "attractions"], visitMinutes: 90, indoor: true };
      if (t === "theme_park") return { category: "theme_park", tags: ["kids", "adventure", "attractions"], visitMinutes: 300, indoor: false };
      if (t === "viewpoint") return { category: "viewpoint", tags: ["views", "photography", "free"], visitMinutes: 20, indoor: false };
      break;
    case "leisure":
      if (t === "park" || t === "garden") return { category: t === "garden" ? "garden" : "park", tags: ["nature", "walking", "free"], visitMinutes: 60, indoor: false };
      if (t === "water_park") return { category: "theme_park", tags: ["kids", "attractions"], visitMinutes: 180, indoor: false };
      break;
    case "natural":
      if (t === "beach") return { category: "beach", tags: ["beaches", "nature", "free"], visitMinutes: 120, indoor: false };
      return { category: "nature", tags: ["nature", "views"], visitMinutes: 90, indoor: false };
    case "historic":
      if (t === "castle") return { category: "castle", tags: ["history", "views"], visitMinutes: 90, indoor: false };
      if (t === "monument" || t === "memorial") return { category: "monument", tags: ["history", "photography", "free"], visitMinutes: 20, indoor: false };
      return { category: "landmark", tags: ["history", "iconic"], visitMinutes: 60, indoor: false };
    case "shop":
      return { category: "shopping", tags: ["shopping", "local"], visitMinutes: 60, indoor: true };
    case "place":
      if (t === "square") return { category: "square", tags: ["city", "free", "walking"], visitMinutes: 20, indoor: false };
      return { category: "neighborhood", tags: ["city", "walking", "local"], visitMinutes: 90, indoor: false };
    case "man_made":
      if (t === "tower") return { category: "tower", tags: ["views", "architecture", "attractions"], visitMinutes: 45, indoor: false };
      if (t === "bridge") return { category: "bridge", tags: ["architecture", "photography", "free"], visitMinutes: 20, indoor: false };
      break;
    case "building":
      if (t === "church" || t === "cathedral" || t === "temple" || t === "mosque" || t === "synagogue") return { category: "church", tags: ["religion", "architecture"], visitMinutes: 30, indoor: true };
      break;
  }
  return { category: "landmark", tags: ["iconic"], visitMinutes: 60, indoor: false };
}

/** A catalogue entry for a wished place we only know from the traveller / OSM: marked unverified, iconic for scoring. */
export function syntheticPlace(entry: MustVisit, point: { lat: number; lng: number }, cities: CitySeed[], extra: { wikidata?: string | null; website?: string | null; nameEn?: string; osmClass?: string; osmType?: string; description?: string; openingHours?: string | null } = {}): PlaceSeed | null {
  const city = nearestCity(cities, point);
  const nameEn = extra.nameEn?.trim() || entry.name.trim();
  const kind = classifyOsmKind(extra.osmClass, extra.osmType);
  const candidate = {
    id: `${city.countryCode.toLowerCase()}-wish-${slug(entry.name)}`,
    externalId: null,
    countryCode: city.countryCode,
    city: city.slug,
    nameLocal: entry.name.trim(),
    names: { en: nameEn, he: entry.name.trim(), local: entry.name.trim() },
    category: kind.category,
    tags: kind.tags,
    lat: point.lat,
    lng: point.lng,
    elevationM: null,
    openingHours: extra.openingHours ?? null,
    closedDates: [],
    visitMinutes: kind.visitMinutes,
    iconicity: 0.8,
    minAge: null,
    wheelchair: "unknown" as const,
    strollerOk: null,
    priceLevel: null,
    website: extra.website && /^https?:\/\//.test(extra.website) ? extra.website : null,
    ticketUrl: null,
    requiresAdvanceBooking: false,
    indoor: kind.indoor,
    kidFriendly: kind.category !== "nightlife",
    summary: extra.description ? { en: { text: extra.description, url: null } } : undefined,
    dataQuality: "unverified" as const,
    source: "user" as const,
    wikidata: extra.wikidata && /^Q\d+$/.test(extra.wikidata) ? extra.wikidata : null,
  };
  const parsed = placeSeedSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

