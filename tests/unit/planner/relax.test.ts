import { describe, expect, it } from "vitest";
import { generateItinerary } from "@/lib/planner";
import { borrowBeaches, beachesNear, isBeach } from "@/lib/planner/beaches";
import { isRelaxDay } from "@/lib/planner/schedule";
import { assertInvariants, loadMany, prefsFor } from "./helpers";

/**
 * Beach holiday ("relax" trip style): most days are a beach block until mid-afternoon
 * with at most two stops after it; every third full day is an outing. Lisbon has no
 * beach of its own, so the coast filed under Sintra is borrowed.
 */
describe("scenario: beach holiday in Lisbon, 7 days", () => {
  const data = loadMany(["PT"]);
  const lisbon = data.cities.find((c) => c.slug === "lisbon")!;
  const own = data.places.filter((p) => p.city === "lisbon");
  const borrowed = borrowBeaches(data.places.filter((p) => p.city !== "lisbon"), [lisbon]);
  const places = [...own, ...borrowed];
  const prefs = prefsFor({
    destinations: [{ countryCode: "PT", cities: ["lisbon"] }],
    dates: { start: "2026-10-12", days: 7, arrivalTime: "11:00", departureTime: "18:00" },
    tripStyle: "relax",
    interests: ["beaches", "food", "city"],
  });
  const { itinerary } = generateItinerary({ prefs, places, cities: [lisbon] });
  const beachIds = beachesNear(places, lisbon.center).map((p) => p.id);

  it("borrows the coast: Carcavelos and Guincho within reach, re-tagged to Lisbon", () => {
    expect(borrowed.map((p) => p.id)).toContain("pt-sintra-praia-de-carcavelos");
    expect(borrowed.every((p) => p.city === "lisbon" && isBeach(p))).toBe(true);
    expect(beachesNear(places, lisbon.center)[0].id).toBe("pt-sintra-praia-de-carcavelos");
  });

  it("keeps the invariants and never uses a beach as a sightseeing stop", () => {
    assertInvariants(itinerary, prefs, places);
    const byId = new Map(places.map((p) => [p.id, p]));
    for (const day of itinerary.days) for (const a of day.activities) if (a.kind === "visit") expect(isBeach(byId.get(a.placeId!)!)).toBe(false);
  });

  it("gives relax days a beach block until mid-afternoon and at most two stops", () => {
    for (const day of itinerary.days) {
      const relax = isRelaxDay(prefs, { kind: day.kind, dayIndex: day.index, isDayTrip: false });
      const leisure = day.activities.filter((a) => a.kind === "leisure");
      const visits = day.activities.filter((a) => a.kind === "visit");
      if (relax) {
        expect(leisure.length, `day ${day.index} leisure`).toBe(1);
        expect(beachIds, `day ${day.index} beach`).toContain(leisure[0].placeId);
        expect(leisure[0].endMin - leisure[0].startMin).toBeGreaterThanOrEqual(60);
        expect(leisure[0].endMin).toBeLessThanOrEqual(16 * 60);
        expect(visits.length, `day ${day.index} visits`).toBeLessThanOrEqual(2);
        expect(day.theme).toBe("relax");
        for (const v of visits) expect(v.startMin).toBeGreaterThanOrEqual(leisure[0].endMin);
      } else {
        expect(leisure.length, `day ${day.index} outing`).toBe(0);
        expect(visits.length, `day ${day.index} outing stops`).toBeGreaterThanOrEqual(3);
        expect(visits.every((v) => v.reasons[0]?.code === "excursion_day")).toBe(true);
      }
    }
    // Days 2 and 5 (0-based) are the outings of a 7-day holiday.
    expect(itinerary.days.map((d) => isRelaxDay(prefs, { kind: d.kind, dayIndex: d.index, isDayTrip: false }))).toEqual([true, true, false, true, true, false, true]);
  });

  it("does not warn that relax days are too light", () => {
    expect(itinerary.days.flatMap((d) => d.warnings).filter((w) => w.code === "day_too_light")).toEqual([]);
  });

  it("falls back to hotel and pool time where there is no beach within reach", () => {
    const rome = loadMany(["IT"]);
    const milan = rome.cities.find((c) => c.slug === "milan")!;
    const inland = rome.places.filter((p) => p.city === "milan" && !isBeach(p));
    const p = prefsFor({ destinations: [{ countryCode: "IT", cities: ["milan"] }], dates: { start: "2026-10-12", days: 4, arrivalTime: null, departureTime: null }, tripStyle: "relax" });
    const it = generateItinerary({ prefs: p, places: inland, cities: [milan] }).itinerary;
    const leisure = it.days[1].activities.find((a) => a.kind === "leisure")!;
    expect(leisure.placeId).toBeNull();
    expect(leisure.reasons[0].code).toBe("relax_hotel");
  });
});
