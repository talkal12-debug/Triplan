import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { generateItinerary } from "@/lib/planner";
import { poisFileSchema } from "@/lib/data/schemas";
import { assertInvariants, loadMany, prefsFor } from "./helpers";

vi.mock("server-only", () => ({}));

/**
 * The traveller says how many days each extra destination gets. Six days in Milan with one
 * day at Lake Como: one hotel in Milan and a single (long) day trip, not half the trip at the lake.
 */
describe("scenario: days per destination", () => {
  const seed = loadMany(["IT"]);
  const world = poisFileSchema.parse(JSON.parse(readFileSync(join(process.cwd(), "data", "world", "it.json"), "utf8")));
  const como = world.cities.find((c) => c.slug === "lake-como")!;
  const places = [...seed.places.filter((p) => p.city === "milan"), ...world.places.filter((p) => p.city === "lake-como")];
  const cities = [seed.cities.find((c) => c.slug === "milan")!, como];
  const plan = (cityDays: Record<string, number> | undefined, days = 6) => {
    const prefs = prefsFor({
      destinations: [{ countryCode: "IT", cities: ["milan", "lake-como"], cityDays }],
      dates: { start: "2026-11-02", days, arrivalTime: null, departureTime: null },
      hotel: { type: "4star", locationPref: "center", baseMode: "auto" },
    });
    const { itinerary } = generateItinerary({ prefs, places, cities });
    assertInvariants(itinerary, prefs, places);
    return itinerary;
  };

  it("one day at Lake Como on a six-day Milan trip: one hotel in Milan and one day trip", () => {
    const itinerary = plan({ "lake-como": 1 });
    expect(itinerary.stays).toHaveLength(1);
    expect(itinerary.stays[0].citySlug).toBe("milan");
    expect(itinerary.days.filter((d) => d.citySlug === "lake-como")).toHaveLength(1);
    expect(itinerary.days.filter((d) => d.citySlug === "milan")).toHaveLength(5);
  });

  it("two days: two day trips from the same hotel", () => {
    const itinerary = plan({ "lake-como": 2 });
    expect(itinerary.stays).toHaveLength(1);
    expect(itinerary.days.filter((d) => d.citySlug === "lake-como")).toHaveLength(2);
  });

  it("three days: a stay of its own with exactly three days", () => {
    const itinerary = plan({ "lake-como": 3 }, 7);
    expect(itinerary.stays.map((s) => s.citySlug)).toEqual(["milan", "lake-como"]);
    expect(itinerary.days.filter((d) => d.citySlug === "lake-como")).toHaveLength(3);
    expect(itinerary.days.filter((d) => d.citySlug === "milan")).toHaveLength(4);
  });

  it("without a choice the planner still decides (its own stay, as before)", () => {
    const itinerary = plan(undefined);
    expect(itinerary.stays.length).toBeGreaterThanOrEqual(1);
    expect(itinerary.days.some((d) => d.citySlug === "lake-como")).toBe(true);
  });
});

describe("a typed wish that names a destination", () => {
  it("'אגם קומו' as a must-visit place on a Milan trip becomes a one-day destination", async () => {
    const { promoteDestinationWishes } = await import("@/lib/server/destination-wishes");
    const prefs = prefsFor({
      destinations: [{ countryCode: "IT", cities: ["milan"] }],
      dates: { start: "2026-11-02", days: 6, arrivalTime: null, departureTime: null },
      mustVisit: [{ name: "אגם קומו", placeId: null }, { name: "Duomo di Milano", placeId: null }],
    });
    const out = promoteDestinationWishes(prefs);
    expect(out.destinations[0].cities).toEqual(["milan", "lake-como"]);
    expect(out.destinations[0].cityDays).toEqual({ "lake-como": 1 });
    expect(out.destinations[0].customCities?.map((c) => c.slug)).toEqual(["lake-como"]);
    expect(out.mustVisit.map((m) => m.name)).toEqual(["Duomo di Milano"]);
  });

  it("leaves wishes alone when the planner picks the cities anyway", async () => {
    const { promoteDestinationWishes } = await import("@/lib/server/destination-wishes");
    const prefs = prefsFor({ destinations: [{ countryCode: "IT", cities: [] }], mustVisit: [{ name: "אגם קומו", placeId: null }] });
    expect(promoteDestinationWishes(prefs)).toBe(prefs);
  });
});
