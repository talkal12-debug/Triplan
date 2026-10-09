import { describe, expect, it } from "vitest";
import { selectPlaces, clampBox, overpassQueriesFor, slugify } from "@/lib/providers/pois/osm-core";
import type { PlaceSeed } from "@/lib/data/schemas";
import { worldCities } from "../../scripts/world/cities";

/**
 * The prebuilt world catalogue shares its ranking with the live OSM provider:
 * most notable first, no duplicates, and a floor of parks, viewpoints and
 * markets so a city is not eighty churches.
 */
const place = (id: string, category: PlaceSeed["category"], iconicity: number, hours = false): PlaceSeed => ({
  id: `fr-paris-${id}`,
  externalId: `osm:node:${id}`,
  countryCode: "FR",
  city: "paris",
  nameLocal: id,
  names: { en: id, local: id },
  category,
  tags: ["history"],
  lat: 48.85,
  lng: 2.35,
  elevationM: null,
  openingHours: hours ? "Mo-Su 09:00-18:00" : null,
  closedDates: [],
  visitMinutes: 60,
  iconicity,
  minAge: null,
  wheelchair: "unknown",
  strollerOk: null,
  priceLevel: null,
  website: null,
  ticketUrl: null,
  requiresAdvanceBooking: false,
  indoor: false,
  kidFriendly: true,
  dataQuality: hours ? "verified" : "partial",
  source: "osm",
  wikidata: null,
});

describe("world catalogue ranking", () => {
  it("keeps the most notable, drops duplicates by name, prefers places with hours on ties", () => {
    const list = [place("alpha", "church", 0.9), place("b", "church", 0.9, true), { ...place("c", "museum", 0.5), nameLocal: "A", names: { en: "A", local: "A" } }, place("A", "museum", 0.95)];
    const out = selectPlaces(list, 10);
    expect(out.map((p) => p.id)).toEqual(["fr-paris-A", "fr-paris-b", "fr-paris-alpha"]);
  });

  it("makes room for parks and viewpoints when the cut is all churches", () => {
    const churches = Array.from({ length: 20 }, (_, i) => place(`church-${i}`, "church", 0.9 - i * 0.01));
    const extras = [place("park", "park", 0.4), place("view", "viewpoint", 0.35), place("market", "market", 0.3)];
    const out = selectPlaces([...churches, ...extras], 12);
    expect(out).toHaveLength(12);
    expect(out.map((p) => p.category)).toEqual(expect.arrayContaining(["park", "viewpoint", "market"]));
    // The most notable churches survive; the least notable gave way.
    expect(out.some((p) => p.id === "fr-paris-church-0")).toBe(true);
    expect(out.some((p) => p.id === "fr-paris-church-19")).toBe(false);
  });

  it("never exceeds the limit, and returns everything when under it", () => {
    expect(selectPlaces([place("x", "park", 0.5)], 80)).toHaveLength(1);
    const many = Array.from({ length: 200 }, (_, i) => place(`p-${i}`, i % 7 === 0 ? "park" : "museum", Math.random()));
    expect(selectPlaces(many, 80).length).toBeLessThanOrEqual(80);
  });
});

describe("world city list", () => {
  it("has unique slugs per country and valid country codes", () => {
    const seen = new Set<string>();
    for (const c of worldCities) {
      expect(c.cc).toMatch(/^[A-Z]{2}$/);
      const key = `${c.cc}:${slugify(c.en)}`;
      expect(seen.has(key), key).toBe(false);
      seen.add(key);
    }
    expect(worldCities.length).toBeGreaterThan(250);
  });

  it("builds bounded Overpass queries", () => {
    const box = clampBox([48.6, 2.0, 49.1, 2.7], { lat: 48.8566, lng: 2.3522 });
    expect(box[2] - box[0]).toBeLessThanOrEqual(0.24 + 1e-9);
    const { tier1, tier2 } = overpassQueriesFor(box, 90);
    expect(tier1).toContain("[timeout:90]");
    expect(tier1).toContain('"wikipedia"');
    expect(tier2).toContain('[!"wikipedia"]');
  });
});
