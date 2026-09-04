import { describe, expect, it } from "vitest";
import type { DayPlan } from "@/lib/planner/assign";
import { isHeavy, reorderForVariety } from "@/lib/planner/variety";

function day(index: number, opts: Partial<DayPlan>): DayPlan {
  return {
    dayIndex: index,
    stayId: "stay-1",
    citySlug: "lisbon",
    isDayTrip: false,
    isTransfer: false,
    dayTripMinutes: 0,
    kind: index === 0 ? "arrival" : "full",
    date: `2026-10-${16 + index}`,
    clusterIds: [],
    candidates: [],
    capacity: 400,
    theme: "city",
    indoorShare: 0,
    plannedWalkKm: 3,
    ...opts,
  };
}

describe("variety", () => {
  it("flags day trips and long walks as heavy", () => {
    expect(isHeavy(day(1, { isDayTrip: true }), 12)).toBe(true);
    expect(isHeavy(day(1, { plannedWalkKm: 9 }), 12)).toBe(true);
    expect(isHeavy(day(1, { plannedWalkKm: 4 }), 12)).toBe(false);
  });

  it("separates two heavy days when a light day is available", () => {
    const days = [
      day(0, {}),
      day(1, { plannedWalkKm: 10, theme: "history" }),
      day(2, { plannedWalkKm: 10, theme: "museums" }),
      day(3, { plannedWalkKm: 2, theme: "food" }),
    ];
    const out = reorderForVariety(days, 12);
    expect(out.map((d) => d.dayIndex)).toEqual([0, 1, 2, 3]); // indexes/dates never move
    expect(out.map((d) => d.theme)).toEqual(["city", "history", "food", "museums"]);
  });

  it("separates two days with the same theme", () => {
    const days = [day(0, {}), day(1, { theme: "museums" }), day(2, { theme: "museums" }), day(3, { theme: "nature" })];
    const out = reorderForVariety(days, 12);
    expect(out.map((d) => d.theme)).toEqual(["city", "museums", "nature", "museums"]);
  });

  it("never moves arrival, departure or transfer days, nor across stays", () => {
    const days = [
      day(0, { theme: "museums" }),
      day(1, { theme: "museums", isTransfer: true }),
      day(2, { theme: "museums", stayId: "stay-2" }),
      day(3, { theme: "nature", stayId: "stay-2", kind: "departure" }),
    ];
    const out = reorderForVariety(days, 12);
    expect(out.map((d) => d.theme)).toEqual(["museums", "museums", "museums", "nature"]);
  });
});
