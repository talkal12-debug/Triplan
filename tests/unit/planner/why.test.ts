import { describe, expect, it } from "vitest";
import { timingReasons } from "@/lib/planner/schedule";
import { dayWhyLines } from "@/lib/trip/day-why";
import type { GuestPlan } from "@/lib/guest/trips";
import type { ItineraryDay } from "@/lib/planner/itinerary";
import { loadMany } from "./helpers";

/**
 * "Why this, why now": reasons that come from the clock, so the traveller sees
 * that a lunchtime closure put a place first and a Monday closure put it on Tuesday.
 */
describe("timing reasons", () => {
  const base = loadMany(["PT"]).places.find((p) => p.id === "pt-lisbon-torre-de-belem")!;
  const week = ["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15"]; // Mon-Thu

  it("says a place that shuts at lunchtime goes first", () => {
    const place = { ...base, openingHours: "Mo-Su 09:00-14:00", closedDates: [] };
    const codes = timingReasons(place, "2026-10-13", 9 * 60 + 30, 0, week).map((r) => r.code);
    expect(codes).toContain("closes_early");
    expect(timingReasons(place, "2026-10-13", 9 * 60 + 30, 0, week).find((r) => r.code === "closes_early")?.params).toEqual({ time: "14:00" });
    // The same place as the fourth stop of the day is not "first thing" any more.
    expect(timingReasons(place, "2026-10-13", 9 * 60 + 30, 3, week).map((r) => r.code)).not.toContain("closes_early");
  });

  it("says a late opener was put in the afternoon", () => {
    const place = { ...base, openingHours: "Mo-Su 14:00-22:00", closedDates: [] };
    const reasons = timingReasons(place, "2026-10-13", 15 * 60, 2, week);
    expect(reasons.find((r) => r.code === "opens_late")?.params).toEqual({ time: "14:00" });
  });

  it("names the trip days on which the place is closed", () => {
    const place = { ...base, openingHours: "Tu-Su 10:00-18:00", closedDates: ["2026-10-15"] };
    const reasons = timingReasons(place, "2026-10-13", 11 * 60, 1, week);
    expect(reasons.find((r) => r.code === "closed_other_days")?.params).toEqual({ weekdays: "monday,thursday" });
  });

  it("marks a late viewpoint as the sunset stop, and nothing for unknown hours", () => {
    const view = { ...base, category: "viewpoint" as const, openingHours: null, closedDates: [] };
    expect(timingReasons(view, "2026-10-13", 17 * 60, 3, week).map((r) => r.code)).toEqual(["sunset_last"]);
    expect(timingReasons({ ...base, openingHours: null, closedDates: [] }, "2026-10-13", 10 * 60, 0, week)).toEqual([]);
  });
});

describe("why the day looks like this", () => {
  const visit = (id: string, minutes: number | null, codes: string[] = []): ItineraryDay["activities"][number] => ({
    id,
    kind: "visit",
    placeId: id,
    startMin: 600,
    endMin: 660,
    locked: false,
    reasons: codes.map((code) => ({ code: code as never, params: {} })),
    transitFromPrev: minutes === null ? null : { mode: "walk", minutes, meters: minutes * 80, estimated: true },
    dataQuality: null,
  });
  const day = { date: "2026-10-13", activities: [visit("a", null, ["must_visit"]), visit("b", 8, ["closes_early"]), visit("c", 15), visit("d", 12, ["closed_other_days"])] } as unknown as ItineraryDay;
  const plan = { places: { a: { indoor: true }, b: { indoor: true }, c: { indoor: false }, d: { indoor: true } }, extras: { weather: { "2026-10-13": { precipProbability: 70 } } } } as unknown as GuestPlan;
  const t = { compact: (m: number) => `compact ${m}`, timed: (n: number) => `timed ${n}`, rain: (n: number) => `rain ${n}`, wishes: (n: number) => `wishes ${n}` };

  it("summarises walking, timing, rain and wishes", () => {
    expect(dayWhyLines(plan, day, t)).toEqual(["compact 15", "timed 2", "rain 3", "wishes 1"]);
  });

  it("says nothing for a day with a single stop", () => {
    expect(dayWhyLines(plan, { ...day, activities: [day.activities[0]] } as ItineraryDay, t)).toEqual([]);
  });
});
