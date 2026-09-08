import { describe, expect, it } from "vitest";
import { sleepZones } from "@/lib/planner/sleep-zones";
import type { Itinerary } from "@/lib/planner/itinerary";

/**
 * "Where to sleep" ranks areas by the mean distance to every day of the stay:
 * a base between two days' neighbourhoods beats one that only serves one day.
 */
const visit = (id: string): Itinerary["days"][number]["activities"][number] => ({ id, kind: "visit", placeId: id, startMin: 600, endMin: 660, locked: false, reasons: [], transitFromPrev: null, dataQuality: null });

const itinerary = {
  stays: [{ id: "stay-1", citySlug: "lisbon", countryCode: "PT", fromDay: 0, toDay: 1, center: { lat: 38.75, lng: -9.2 }, locationPref: "center" }],
  days: [
    { index: 0, date: "2026-10-12", stayId: "stay-1", activities: [visit("west-a"), visit("west-b")] },
    { index: 1, date: "2026-10-13", stayId: "stay-1", activities: [visit("east-a"), visit("east-b")] },
  ],
} as unknown as Itinerary;

// Two neighbourhoods 4 km apart on the same latitude; the planner's base is far to the north-west.
const places = {
  "west-a": { lat: 38.7, lng: -9.2 },
  "west-b": { lat: 38.7, lng: -9.19 },
  "east-a": { lat: 38.7, lng: -9.155 },
  "east-b": { lat: 38.7, lng: -9.145 },
};

describe("sleep zones", () => {
  it("prefers the area between the days over either day's own centre", () => {
    const zones = sleepZones(itinerary, places, "stay-1");
    expect(zones.length).toBeGreaterThanOrEqual(2);
    // Best zone: the overall centroid, about 2 km from each day's centre; the far base comes last, if at all.
    expect(zones[0].lng).toBeCloseTo(-9.1725, 2);
    expect(zones[0].avgKm).toBeLessThanOrEqual(zones[1].avgKm);
    expect(zones[0].daysNear).toBe(2);
    expect(zones[0].days).toBe(2);
    expect(zones.every((z) => z.anchorPlaceId in places)).toBe(true);
    expect(zones.some((z) => Math.abs(z.lat - 38.75) < 0.001)).toBe(false);
  });

  it("merges candidates closer than 800 m and returns nothing without visits", () => {
    const zones = sleepZones(itinerary, places, "stay-1");
    for (let i = 0; i < zones.length; i++) for (let j = i + 1; j < zones.length; j++) expect(Math.abs(zones[i].lng - zones[j].lng) + Math.abs(zones[i].lat - zones[j].lat)).toBeGreaterThan(0.005);
    expect(sleepZones(itinerary, {}, "stay-1")).toEqual([]);
    expect(sleepZones(itinerary, places, "nope")).toEqual([]);
  });
});
