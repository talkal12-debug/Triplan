import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { computeBudgets, generateItinerary } from "@/lib/planner";
import { reorderDay } from "@/lib/planner/edit";
import { poisFileSchema } from "@/lib/data/schemas";
import { dayTripRoutes } from "@/lib/trip/google-maps";
import type { GuestPlan } from "@/lib/guest/schema";
import { assertInvariants, loadMany, prefsFor } from "./helpers";

/**
 * A chosen city too far for a comfortable day trip from a single hotel is kept as a
 * long day trip (with the fastest-route links), not dropped. Milan + Lake Como, one hotel.
 */
describe("scenario: Milan with Lake Como, one hotel", () => {
  const seed = loadMany(["IT"]);
  const world = poisFileSchema.parse(JSON.parse(readFileSync(join(process.cwd(), "data", "world", "it.json"), "utf8")));
  const como = world.cities.find((c) => c.slug === "lake-como")!;
  const places = [...seed.places.filter((p) => p.city === "milan"), ...world.places.filter((p) => p.city === "lake-como")];
  const cities = [seed.cities.find((c) => c.slug === "milan")!, como];
  const prefs = prefsFor({
    destinations: [{ countryCode: "IT", cities: ["milan", "lake-como"] }],
    dates: { start: "2026-11-02", days: 5, arrivalTime: null, departureTime: null },
    hotel: { type: "4star", locationPref: "center", baseMode: "single" },
  });
  const { itinerary } = generateItinerary({ prefs, places, cities });

  it("keeps one hotel in Milan and Lake Como as a long day trip, with a notice instead of a drop", () => {
    assertInvariants(itinerary, prefs, places);
    expect(itinerary.stays).toHaveLength(1);
    expect(itinerary.stays[0].citySlug).toBe("milan");
    expect(itinerary.warnings.some((w) => w.code === "base_too_far")).toBe(false);
    expect(itinerary.warnings.find((w) => w.code === "long_day_trip")?.params.city).toBe("lake-como");
    const trip = itinerary.days.filter((d) => d.citySlug === "lake-como");
    expect(trip).toHaveLength(1);
    expect(trip[0].dayTrip?.long).toBe(true);
    expect(trip[0].dayTrip?.minutesEachWay).toBeGreaterThan(90);
    expect(trip[0].activities.some((a) => a.kind === "visit")).toBe(true);
    expect(itinerary.days.filter((d) => d.citySlug === "milan").every((d) => !d.dayTrip)).toBe(true);
  });

  it("keeps the trip and its travel time when the day is re-timed (real routing, reordering)", () => {
    const day = itinerary.days.find((d) => d.citySlug === "lake-como")!;
    const ids = day.activities.filter((a) => a.kind === "visit").map((a) => a.placeId!);
    const out = reorderDay(itinerary, day.index, [...ids].reverse(), { prefs, places, cities }, { keepAll: true });
    const again = out.days[day.index];
    expect(again.dayTrip).toEqual(day.dayTrip);
    const firstVisit = Math.min(...again.activities.filter((a) => a.kind === "visit").map((a) => a.startMin));
    // The train and ferry come first: no visit before the hotel departure plus the trip there.
    expect(firstVisit).toBeGreaterThanOrEqual(computeBudgets(prefs).dayStart + day.dayTrip!.minutesEachWay);
  });

  it("offers the fastest way there and back in Google Maps, by public transport and by car", () => {
    const plan = { itinerary, places: Object.fromEntries(places.map((p) => [p.id, p])), cities, unused: [] } as unknown as GuestPlan;
    const day = itinerary.days.find((d) => d.citySlug === "lake-como")!;
    const routes = dayTripRoutes(plan, day.index)!;
    expect(routes.long).toBe(true);
    const milan = itinerary.stays[0].center;
    expect(routes.there.transit).toContain("travelmode=transit");
    expect(routes.there.transit).toContain(`origin=${milan.lat.toFixed(6)}%2C${milan.lng.toFixed(6)}`);
    expect(routes.back.transit).toContain(`destination=${milan.lat.toFixed(6)}%2C${milan.lng.toFixed(6)}`);
    expect(routes.there.driving).toContain("travelmode=driving");
    expect(dayTripRoutes(plan, itinerary.days.find((d) => d.citySlug === "milan")!.index)).toBeNull();
  });

  it("still gives up on a city hours away, with the old warning", () => {
    const pt = loadMany(["PT"]);
    const far = prefsFor({
      destinations: [{ countryCode: "PT", cities: ["lisbon", "porto"] }],
      dates: { start: "2026-10-16", days: 6, arrivalTime: null, departureTime: null },
      hotel: { type: "4star", locationPref: "center", baseMode: "single" },
    });
    const it2 = generateItinerary({ prefs: far, places: pt.places, cities: pt.cities }).itinerary;
    expect(it2.warnings.some((w) => w.code === "base_too_far")).toBe(true);
  });
});
