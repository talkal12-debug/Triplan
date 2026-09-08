import { describe, expect, it } from "vitest";
import { accessibilityFromTravelers, needsFor, partyFromTravelers, travelersFromParty, tripPreferencesSchema, defaultTripPreferences, type Traveler } from "@/lib/planner/types";
import { dayFit } from "@/lib/trip/day-fit";
import type { ItineraryDay } from "@/lib/planner/itinerary";

const tr = (id: string, kind: Traveler["kind"], extra: Partial<Traveler> = {}): Traveler => ({ id, name: "", kind, age: null, needs: [], ...extra });

describe("family profiles", () => {
  it("derives the planner's counts from the rows", () => {
    const rows = [tr("g", "senior", { name: "Saba", needs: ["lowWalking"] }), tr("a", "adult"), tr("c", "child", { age: 4, needs: ["stroller", "naps"] }), tr("b", "infant")];
    expect(partyFromTravelers(rows)).toEqual({ adults: 2, seniors: 1, childrenAges: [4], infants: 1, stroller: true });
    expect(accessibilityFromTravelers(rows)).toEqual(["stroller"]);
    // Never fewer than one adult, whatever was entered.
    expect(partyFromTravelers([tr("c", "child", { age: 9 })]).adults).toBe(1);
  });

  it("turns an old counts-only draft into rows and back", () => {
    const party = { adults: 3, seniors: 1, childrenAges: [3, 12], infants: 0, stroller: true };
    const rows = travelersFromParty(party);
    expect(rows.map((r) => r.kind)).toEqual(["senior", "adult", "adult", "child", "child"]);
    expect(rows[3].needs).toEqual(["stroller"]);
    expect(rows[4].needs).toEqual([]);
    expect(partyFromTravelers(rows)).toEqual(party);
  });

  it("asks each kind only the needs that apply", () => {
    expect(needsFor({ kind: "infant", age: null })).toEqual(["stroller"]);
    expect(needsFor({ kind: "child", age: 4 })).toContain("naps");
    expect(needsFor({ kind: "child", age: 12 })).not.toContain("stroller");
    expect(needsFor({ kind: "senior", age: null })).toContain("wheelchair");
  });

  it("keeps old preferences valid: travellers default to none", () => {
    const parsed = tripPreferencesSchema.parse({ ...defaultTripPreferences(), destinations: [{ countryCode: "PT", cities: ["lisbon"] }], travelers: undefined });
    expect(parsed.travelers).toEqual([]);
  });
});

describe("whom the day suits", () => {
  const act = (id: string, kind: "visit" | "rest" | "meal", startMin: number, endMin: number): ItineraryDay["activities"][number] => ({ id, kind, placeId: kind === "visit" ? id : null, startMin, endMin, locked: false, reasons: [], transitFromPrev: null, dataQuality: null });
  const places = { a: { wheelchair: "yes" as const }, b: { wheelchair: "no" as const }, c: { wheelchair: "limited" as const } };
  const long = { stats: { walkKm: 7, intensity: "heavy" }, activities: [act("a", "visit", 540, 600), act("b", "visit", 620, 700), act("c", "visit", 720, 900)] } as unknown as ItineraryDay;
  const gentle = { stats: { walkKm: 2, intensity: "light" }, activities: [act("a", "visit", 540, 600), act("m", "meal", 720, 780), act("c", "visit", 800, 900)] } as unknown as ItineraryDay;

  it("flags walking, strain, missing breaks and inaccessible stops per traveller", () => {
    const fam = [tr("s", "senior", { name: "Saba" }), tr("k", "child", { age: 4 }), tr("w", "adult", { needs: ["wheelchair"] }), tr("ok", "adult")];
    const fit = dayFit(long, places, fam);
    expect(fit.map((f) => [f.traveler.id, f.issues])).toEqual([
      ["s", ["walk", "heavy"]],
      ["k", ["walk", "rest"]],
      ["w", ["access"]],
    ]);
  });

  it("says nothing on a gentle day with a break, and only 'partly' for limited access", () => {
    expect(dayFit(gentle, places, [tr("s", "senior"), tr("k", "child", { age: 4 })])).toEqual([]);
    expect(dayFit(gentle, { a: places.a, c: places.c }, [tr("w", "adult", { needs: ["stroller"] })])[0].issues).toEqual(["accessLimited"]);
    expect(dayFit(gentle, places, [])).toEqual([]);
  });
});
