import { describe, expect, it } from "vitest";
import { generateItinerary } from "@/lib/planner";
import { exclusionReason, scorePlace } from "@/lib/planner/scoring";
import { loadMany, prefsFor, visitIds } from "./helpers";

/** Milestone 11: wishlist places outrank everything, bypass soft filters and are flagged when they do not fit. */
describe("must-visit places", () => {
  const data = loadMany(["PT"]);
  // A low-iconicity Lisbon place that a 3-day first visit would normally skip.
  const lowKey = [...data.places].filter((p) => p.city === "lisbon" && p.iconicity < 0.4).sort((a, b) => a.iconicity - b.iconicity)[0];
  const base = {
    destinations: [{ countryCode: "PT", cities: ["lisbon"] }],
    dates: { start: "2026-10-16", days: 3, arrivalTime: null, departureTime: null },
  };

  it("scores a wished place above every ordinary place and ignores 'already seen' for it", () => {
    const prefs = prefsFor({ ...base, mustVisit: [{ name: lowKey.nameLocal, placeId: lowKey.id }], alreadySeen: [lowKey.id] });
    const others = data.places.filter((p) => p.id !== lowKey.id).map((p) => scorePlace(p, prefs));
    expect(scorePlace(lowKey, prefs)).toBeGreaterThan(Math.max(...others));
    expect(exclusionReason(lowKey, prefs)).toBeNull();
  });

  it("places the wished place in the plan and marks the visit with a reason", () => {
    const without = generateItinerary({ prefs: prefsFor(base), places: data.places, cities: data.cities });
    const prefs = prefsFor({ ...base, mustVisit: [{ name: lowKey.nameLocal, placeId: lowKey.id }] });
    const { itinerary } = generateItinerary({ prefs, places: data.places, cities: data.cities });
    expect(visitIds(without.itinerary)).not.toContain(lowKey.id);
    expect(visitIds(itinerary)).toContain(lowKey.id);
    const visit = itinerary.days.flatMap((d) => d.activities).find((a) => a.placeId === lowKey.id)!;
    expect(visit.reasons[0].code).toBe("must_visit");
    expect(itinerary.warnings.some((w) => w.code === "must_visit_unplaced")).toBe(false);
  });

  it("warns about a wished place that never fits (closed every day of the trip)", () => {
    const closed = { ...lowKey, id: "pt-lisbon-test-closed", closedDates: ["2026-10-16", "2026-10-17", "2026-10-18"] };
    const prefs = prefsFor({ ...base, mustVisit: [{ name: "Closed place", placeId: closed.id }] });
    const { itinerary } = generateItinerary({ prefs, places: [...data.places, closed], cities: data.cities });
    expect(visitIds(itinerary)).not.toContain(closed.id);
    const warning = itinerary.warnings.find((w) => w.code === "must_visit_unplaced");
    expect(warning?.params.name).toBe("Closed place");
  });
});
