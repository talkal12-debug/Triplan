import { describe, expect, it } from "vitest";
import { generateItinerary } from "@/lib/planner";
import { refineTravel } from "@/lib/planner/refine";
import { assertInvariants, loadMany, prefsFor, visitIds } from "./helpers";

describe("refineTravel", () => {
  const data = loadMany(["PT"]);
  const prefs = prefsFor({
    destinations: [{ countryCode: "PT", cities: ["lisbon"] }],
    dates: { start: "2026-10-16", days: 4, arrivalTime: null, departureTime: null },
  });
  const ctx = { prefs, places: data.places, cities: data.cities };
  const { itinerary } = generateItinerary({ prefs, places: data.places, cities: data.cities });

  it("keeps the visiting order and replaces estimates with real legs", async () => {
    let calls = 0;
    const { itinerary: out, refinedDays } = await refineTravel(itinerary, ctx, async (points, mode) => {
      calls += 1;
      // Pretend every real leg takes 7 minutes and 500 m.
      const n = points.length;
      return {
        minutes: Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 0 : 7))),
        meters: Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 0 : 500))),
        estimated: mode === "transit",
      };
    });
    expect(calls).toBeGreaterThan(0);
    expect(refinedDays.length).toBe(itinerary.days.length);
    expect(visitIds(out)).toEqual(visitIds(itinerary));
    const legs = out.days.flatMap((d) => d.activities).map((a) => a.transitFromPrev).filter((t): t is NonNullable<typeof t> => Boolean(t));
    expect(legs.some((l) => !l.estimated && l.minutes === 7)).toBe(true);
    assertInvariants(out, prefs, data.places);
  });

  it("leaves days alone when the matrix fetch fails", async () => {
    const { itinerary: out, refinedDays } = await refineTravel(itinerary, ctx, async () => {
      throw new Error("network down");
    });
    expect(refinedDays).toEqual([]);
    expect(out).toEqual(itinerary);
  });

  it("only touches the requested days", async () => {
    const { refinedDays } = await refineTravel(itinerary, ctx, async (points) => ({
      minutes: points.map(() => points.map(() => 5)),
      meters: points.map(() => points.map(() => 400)),
      estimated: false,
    }), [1]);
    expect(refinedDays).toEqual([1]);
  });
});
