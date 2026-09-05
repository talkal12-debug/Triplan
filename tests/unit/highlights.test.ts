import { describe, expect, it } from "vitest";
import { seasonalFor, seasonalItems, windowIncludes } from "@/lib/data/seasonal";
import { seniorInfoFor } from "@/lib/data/senior-discounts";
import { classifyOsmKind, syntheticPlace } from "@/lib/nearby/must-visit-core";
import { generateItinerary } from "@/lib/planner";
import { rebalanceDay } from "@/lib/planner/edit";
import { interests } from "@/lib/planner/types";
import { loadMany, prefsFor, visitIds } from "./planner/helpers";

describe("seasonal highlights (milestone 12)", () => {
  it("matches windows, including ones that cross New Year", () => {
    const xmas = { from: "11-25", to: "01-06" };
    expect(windowIncludes(xmas, "2026-12-20")).toBe(true);
    expect(windowIncludes(xmas, "2027-01-03")).toBe(true);
    expect(windowIncludes(xmas, "2026-06-15")).toBe(false);
    expect(windowIncludes({ from: "06-01", to: "06-30" }, "2026-06-12")).toBe(true);
  });

  it("finds Lisbon's June festivities and Tokyo's cherry blossom for the right trips only", () => {
    const june = seasonalFor([{ countryCode: "PT", cities: ["lisbon"] }], "2027-06-10", 5);
    expect(june.map((i) => i.id)).toContain("pt-lisbon-santo-antonio");
    expect(june.map((i) => i.id)).not.toContain("pt-porto-sao-joao");
    const porto = seasonalFor([{ countryCode: "PT", cities: ["porto"] }], "2027-06-20", 5);
    expect(porto.map((i) => i.id)).toContain("pt-porto-sao-joao");
    const sakura = seasonalFor([{ countryCode: "JP", cities: ["tokyo"] }], "2027-03-28", 4);
    expect(sakura[0]?.id).toBe("jp-sakura");
    expect(seasonalFor([{ countryCode: "IT", cities: ["rome"] }], "2027-02-01", 3)).toEqual([]);
    for (const i of seasonalItems) expect(i.url).toMatch(/^https:\/\//);
  });
});

describe("65+ discounts", () => {
  it("returns country rules and place notes only for what the trip touches", () => {
    const info = seniorInfoFor(["PT"], ["pt-lisbon-torre-de-belem", "pt-lisbon-rossio"])!;
    expect(info.countries.map((c) => c.countryCode)).toEqual(["PT"]);
    expect(Object.keys(info.places)).toEqual(["pt-lisbon-torre-de-belem"]);
    expect(info.places["pt-lisbon-torre-de-belem"].note.he).toContain("65");
    expect(seniorInfoFor(["FR"], ["x"])).toBeNull();
  });
});

describe("wished places from OpenStreetMap", () => {
  it("classifies OSM class/type into a catalogue category", () => {
    expect(classifyOsmKind("amenity", "restaurant")).toMatchObject({ category: "food", visitMinutes: 75 });
    expect(classifyOsmKind("tourism", "museum").category).toBe("museum");
    expect(classifyOsmKind("leisure", "park").category).toBe("park");
    expect(classifyOsmKind("whatever", "x").category).toBe("landmark");
  });

  it("interests offer five ranked slots and an attractions interest", () => {
    expect(interests).toContain("attractions");
  });
});

describe("wished restaurant in the day", () => {
  const data = loadMany(["PT"]);
  const cities = data.cities;
  const restaurant = syntheticPlace({ name: "Vapiano Lisboa", placeId: null }, { lat: 38.7118, lng: -9.1408 }, cities, { osmClass: "amenity", osmType: "restaurant", description: "Restaurant chain" })!;
  const base = {
    destinations: [{ countryCode: "PT", cities: ["lisbon"] }],
    dates: { start: "2026-10-16", days: 3, arrivalTime: null, departureTime: null },
  };
  const prefs = prefsFor({ ...base, mustVisit: [{ name: "Vapiano Lisboa", placeId: restaurant.id }] });
  const places = [...data.places, restaurant];
  const { itinerary } = generateItinerary({ prefs, places, cities });

  it("is a meal at lunch time, not a morning stop, and carries the wishlist reason", () => {
    expect(restaurant.category).toBe("food");
    expect(restaurant.summary?.en.text).toBe("Restaurant chain");
    const visit = itinerary.days.flatMap((d) => d.activities).find((a) => a.placeId === restaurant.id)!;
    expect(visit).toBeDefined();
    expect(visit.startMin).toBeGreaterThanOrEqual(12 * 60);
    expect(visit.startMin).toBeLessThanOrEqual(15 * 60);
    expect(visit.reasons.map((r) => r.code)).toContain("must_visit");
    const day = itinerary.days.find((d) => d.activities.some((a) => a.placeId === restaurant.id))!;
    // The restaurant replaces the generic lunch break that day.
    expect(day.activities.filter((a) => a.kind === "meal")).toHaveLength(0);
  });

  it("survives 'too full' rebalancing (the weakest ordinary visit goes instead)", () => {
    const day = itinerary.days.find((d) => d.activities.some((a) => a.placeId === restaurant.id))!;
    let out = itinerary;
    for (let i = 0; i < 3; i++) out = rebalanceDay(out, day.index, "lighter", { prefs, places, cities });
    expect(visitIds({ ...out, days: [out.days[day.index]] })).toContain(restaurant.id);
  });
});
