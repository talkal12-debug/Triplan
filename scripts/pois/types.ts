import type { PlaceCategory, PlaceTag } from "../../src/lib/data/schemas";

/**
 * Editorial input for one POI. Facts that can be looked up (coordinates,
 * opening hours, wheelchair access, website, wikidata id) are fetched from
 * OpenStreetMap by scripts/build-pois.ts; only judgement calls live here.
 */
export type CuratedPoi = {
  /** slug, unique within the city */
  id: string;
  /** Nominatim query, usually "<local name>, <city>" */
  q: string;
  local: string;
  en: string;
  he: string;
  category: PlaceCategory;
  tags: PlaceTag[];
  /** 0 = only locals know it, 1 = on every postcard */
  iconicity: number;
  visitMinutes: number;
  priceLevel: 0 | 1 | 2 | 3 | 4;
  indoor: boolean;
  kidFriendly: boolean;
  minAge?: number;
  strollerOk?: boolean;
  requiresAdvanceBooking?: boolean;
  /** OSM opening_hours syntax. Used when OSM has none. Marked "partial". */
  hoursFallback?: string;
  /** Approximate coordinates from memory: used to pick the right OSM match and as a last resort. */
  approx: { lat: number; lng: number };
};

export type CuratedCity = {
  slug: string;
  countryCode: "PT" | "IT" | "JP";
  names: { en: string; he: string; local: string };
  center: { lat: number; lng: number };
  /** [south, west, north, east] */
  bbox: [number, number, number, number];
  pois: CuratedPoi[];
};
