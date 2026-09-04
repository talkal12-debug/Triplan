import { describe, expect, it } from "vitest";
import { generateItinerary } from "@/lib/planner";
import { removeActivity, reorderDay } from "@/lib/planner/edit";
import { editOpSchema } from "@/lib/planner/edit-ops";
import { assertInvariants, loadMany, prefsFor, visitIds } from "./helpers";

describe("remove, reorder and the edit-op schema", () => {
  const data = loadMany(["PT"]);
  const prefs = prefsFor({
    destinations: [{ countryCode: "PT", cities: ["lisbon"] }],
    dates: { start: "2026-10-16", days: 4, arrivalTime: null, departureTime: null },
  });
  const ctx = { prefs, places: data.places, cities: data.cities };
  const { itinerary } = generateItinerary({ prefs, places: data.places, cities: data.cities });
  const day = itinerary.days[1];
  const ids = visitIds({ ...itinerary, days: [day] });

  it("removes a visit and keeps the rest in order", () => {
    const victim = day.activities.find((a) => a.kind === "visit")!;
    const out = removeActivity(itinerary, 1, victim.id, ctx);
    const after = visitIds({ ...out, days: [out.days[1]] });
    expect(after).toEqual(ids.filter((id) => id !== victim.placeId));
    assertInvariants(out, prefs, data.places);
  });

  it("reorders a day to the given sequence (unknown ids ignored, missing ones appended)", () => {
    const reversed = [...ids].reverse();
    const out = reorderDay(itinerary, 1, ["not-a-place", ...reversed.slice(0, 2)], ctx);
    const after = visitIds({ ...out, days: [out.days[1]] });
    expect(after.slice(0, 2)).toEqual(reversed.slice(0, 2).filter((id) => after.includes(id)));
    expect(new Set(after)).toEqual(new Set(ids.filter((id) => after.includes(id))));
    assertInvariants(out, prefs, data.places);
  });

  it("validates edit operations strictly", () => {
    expect(editOpSchema.safeParse({ type: "swap", dayIndex: 0, activityId: "0-1", placeId: "x" }).success).toBe(true);
    expect(editOpSchema.safeParse({ type: "rebalance", dayIndex: 0, direction: "sideways" }).success).toBe(false);
    expect(editOpSchema.safeParse({ type: "teleport" }).success).toBe(false);
  });
});
