import { describe, expect, it } from "vitest";
import { generateItinerary } from "@/lib/planner";
import { alternativesFor, moveActivity, rebalanceDay, rebuildUnlocked, swapActivity, toggleLock } from "@/lib/planner/edit";
import { assertInvariants, loadMany, prefsFor, visitIds } from "./helpers";

describe("editing operations", () => {
  const data = loadMany(["IT"]);
  const prefs = prefsFor({
    destinations: [{ countryCode: "IT", cities: ["rome"] }],
    dates: { start: "2026-10-16", days: 5, arrivalTime: null, departureTime: null },
  });
  const ctx = { prefs, places: data.places, cities: data.cities };
  const { itinerary } = generateItinerary({ prefs, places: data.places, cities: data.cities });
  const day = itinerary.days[2];
  const firstVisit = day.activities.find((a) => a.kind === "visit")!;

  it("offers up to 3 nearby, unused, open alternatives of similar length", () => {
    const alts = alternativesFor(itinerary, 2, firstVisit.id, ctx);
    expect(alts.length).toBeGreaterThan(0);
    expect(alts.length).toBeLessThanOrEqual(3);
    const used = new Set(visitIds(itinerary));
    for (const p of alts) {
      expect(used.has(p.id)).toBe(false);
      expect(p.city).toBe("rome");
    }
  });

  it("swaps a place and keeps the day valid", () => {
    const [alt] = alternativesFor(itinerary, 2, firstVisit.id, ctx);
    const out = swapActivity(itinerary, 2, firstVisit.id, alt.id, ctx);
    expect(visitIds(out)).toContain(alt.id);
    expect(visitIds(out)).not.toContain(firstVisit.placeId);
    assertInvariants(out, prefs, data.places);
    // Other days untouched.
    expect(out.days[1]).toEqual(itinerary.days[1]);
  });

  it("moves a place to another day and re-times both", () => {
    const out = moveActivity(itinerary, 2, firstVisit.id, 3, ctx);
    const before2 = visitIds({ ...itinerary, days: [itinerary.days[2]] });
    const after2 = visitIds({ ...out, days: [out.days[2]] });
    const after3 = visitIds({ ...out, days: [out.days[3]] });
    expect(after2).not.toContain(firstVisit.placeId);
    expect(after3.includes(firstVisit.placeId!) || out.days[3].warnings.some((w) => w.code === "day_too_full")).toBe(true);
    expect(after2.length).toBe(before2.length - 1);
    assertInvariants(out, prefs, data.places);
  });

  it("reorders within a day when asked to move to the same day", () => {
    const ids = visitIds({ ...itinerary, days: [day] });
    const lastVisit = day.activities.filter((a) => a.kind === "visit").at(-1)!;
    const out = moveActivity(itinerary, 2, lastVisit.id, 2, ctx, 0);
    const newIds = visitIds({ ...out, days: [out.days[2]] });
    expect(newIds[0]).toBe(lastVisit.placeId);
    expect(new Set(newIds)).toEqual(new Set(ids.filter((id) => newIds.includes(id))));
  });

  it("makes a day lighter by dropping the weakest unlocked visit", () => {
    const before = visitIds({ ...itinerary, days: [day] }).length;
    const out = rebalanceDay(itinerary, 2, "lighter", ctx);
    expect(visitIds({ ...out, days: [out.days[2]] }).length).toBe(before - 1);
    assertInvariants(out, prefs, data.places);
  });

  it("makes a day heavier by adding a nearby unused place when there is room", () => {
    const lighter = rebalanceDay(itinerary, 2, "lighter", ctx);
    const before = visitIds({ ...lighter, days: [lighter.days[2]] }).length;
    const out = rebalanceDay(lighter, 2, "heavier", ctx);
    const after = visitIds({ ...out, days: [out.days[2]] }).length;
    expect(after).toBeGreaterThanOrEqual(before);
  });

  it("locks a visit and rebuilds the rest of the day around it", () => {
    const locked = toggleLock(itinerary, 2, firstVisit.id);
    expect(locked.days[2].activities.find((a) => a.id === firstVisit.id)?.locked).toBe(true);
    const out = rebuildUnlocked(locked, 2, ctx);
    const ids = visitIds({ ...out, days: [out.days[2]] });
    expect(ids[0]).toBe(firstVisit.placeId);
    expect(out.days[2].activities.find((a) => a.placeId === firstVisit.placeId)?.locked).toBe(true);
    assertInvariants(out, prefs, data.places);
  });

  it("never mutates the input itinerary", () => {
    const snapshot = JSON.stringify(itinerary);
    swapActivity(itinerary, 2, firstVisit.id, alternativesFor(itinerary, 2, firstVisit.id, ctx)[0].id, ctx);
    moveActivity(itinerary, 2, firstVisit.id, 1, ctx);
    rebalanceDay(itinerary, 2, "lighter", ctx);
    toggleLock(itinerary, 2, firstVisit.id);
    expect(JSON.stringify(itinerary)).toBe(snapshot);
  });
});
