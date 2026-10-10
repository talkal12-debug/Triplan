import { describe, expect, it } from "vitest";
import { selectPlaces, clampBox, overpassQueriesFor, parseableHours, slugify, dropDuplicatePlaces } from "@/lib/providers/pois/osm-core";
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

  it("caps minor places of worship at a quarter of the city, keeping the major ones", () => {
    const churches = Array.from({ length: 40 }, (_, i) => place(`church-${i}`, "church", 0.7 - i * 0.005));
    const major = [place("duomo", "church", 0.95), place("basilica", "church", 0.9)];
    const villas = Array.from({ length: 20 }, (_, i) => place(`villa-${i}`, "landmark", 0.5));
    const out = selectPlaces([...major, ...churches, ...villas], 40);
    const minor = out.filter((p) => p.category === "church" && p.iconicity < 0.8);
    expect(minor.length).toBeLessThanOrEqual(10);
    expect(out.map((p) => p.id)).toEqual(expect.arrayContaining(["fr-paris-duomo", "fr-paris-basilica"]));
    expect(out.filter((p) => p.category === "landmark")).toHaveLength(20);
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

describe("file-based source: attraction tag net", () => {
  it("mirrors the Overpass queries", async () => {
    const { matchesAttractionFilter } = await import("@/lib/providers/pois/osm-core");
    expect(matchesAttractionFilter({ name: "Louvre", tourism: "museum" })).toBe(true);
    expect(matchesAttractionFilter({ name: "Chapel", amenity: "place_of_worship" })).toBe(false);
    expect(matchesAttractionFilter({ name: "Notre-Dame", amenity: "place_of_worship", wikipedia: "fr:Notre-Dame" })).toBe(true);
    expect(matchesAttractionFilter({ name: "Praia", natural: "beach" })).toBe(true);
    expect(matchesAttractionFilter({ name: "Plaque", historic: "memorial", wikipedia: "x" })).toBe(false);
    expect(matchesAttractionFilter({ tourism: "museum" })).toBe(false);
    expect(matchesAttractionFilter({ name: "Park", leisure: "park" })).toBe(false);
    expect(matchesAttractionFilter({ name: "Park", leisure: "park", wikipedia: "x" })).toBe(true);
  });

  it("selects elements inside a bounding box, ways and relations by their centre", async () => {
    const { elementsInBox } = await import("../../scripts/world/pbf");
    const index = [
      { type: "node", id: 1, lat: 37.02, lon: -7.93, tags: { name: "a" } },
      { type: "way", id: 2, center: { lat: 37.01, lon: -7.94 }, tags: { name: "b" } },
      { type: "relation", id: 3, center: { lat: 38.7, lon: -9.1 }, tags: { name: "lisbon thing" } },
    ];
    expect(elementsInBox(index, [36.9, -8.0, 37.1, -7.9]).map((e) => e.id)).toEqual([1, 2]);
  });
});

describe("opening hours at import", () => {
  // Limassol: the parser knows no public holidays for Cyprus and rejects any "PH" rule there.
  it("keeps the hours without the holiday rule where the country has no holiday calendar", () => {
    expect(parseableHours("Tu-Su 9:00-16:30; Mo,PH off", 34.68, 33.04, "CY")).toBe("Tu-Su 9:00-16:30; Mo off");
    expect(parseableHours("Mo-Fr 08:00-15:30; Sa-Su Off; PH Off", 34.68, 33.04, "CY")).toBe("Mo-Fr 08:00-15:30; Sa-Su Off");
    expect(parseableHours("PH,Mo-Su 08:00-24:00+", 34.68, 33.04, "CY")).toBe("Mo-Su 08:00-24:00+");
    expect(parseableHours("PH Off", 34.68, 33.04, "CY")).toBeNull();
  });

  it("leaves holiday rules alone where the parser knows the holidays", () => {
    expect(parseableHours("Tu-Su 09:00-17:00; PH off", 38.72, -9.14, "PT")).toBe("Tu-Su 09:00-17:00; PH off");
    expect(parseableHours("not hours at all", 38.72, -9.14, "PT")).toBeNull();
  });
});

describe("duplicate places", () => {
  const p = (id: string, en: string, lat: number, lng: number, iconicity: number, wikidata: string | null = null) =>
    ({ id, city: "c", names: { en, local: en }, lat, lng, iconicity, wikidata });
  it("keeps one of a point and its building, one branch per Wikidata id, and same-named places far apart", () => {
    const out = dropDuplicatePlaces([
      p("souk-node", "Spice Souk", 25.2675, 55.2971, 0.6, "Q5310610"),
      p("souk-way", "Spice Souk", 25.2676, 55.2971, 0.4),
      p("ng-trade-fair", "National Gallery in Prague - Trade Fair Palace", 50.1015, 14.4323, 0.9, "Q1419555"),
      p("ng-kinsky", "National Gallery in Prague - Kinsky Palace", 50.088, 14.4217, 0.8, "Q1419555"),
      p("market-a", "Fish Market", 24.4349, 54.4128, 0.3),
      p("market-b", "Fish Market", 24.5143, 54.3761, 0.3),
    ]);
    expect(out.map((x) => x.id)).toEqual(["souk-node", "ng-trade-fair", "market-a", "market-b"]);
  });

  it("leaves the catalogue with no twins", async () => {
    const { readdirSync, readFileSync } = await import("node:fs");
    let twins = 0;
    for (const f of readdirSync("data/world").filter((x) => x.endsWith(".json"))) {
      const places = dropDuplicatePlaces(JSON.parse(readFileSync(`data/world/${f}`, "utf8")).places as Parameters<typeof dropDuplicatePlaces>[0]);
      const seen = new Set<string>();
      for (const x of places) {
        if (!x.wikidata) continue;
        const key = `${x.city}|${x.wikidata}`;
        if (seen.has(key)) twins++;
        seen.add(key);
      }
    }
    expect(twins).toBe(0);
  });
});
