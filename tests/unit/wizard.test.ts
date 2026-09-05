import { describe, expect, it } from "vitest";
import {
  defaultTripPreferences,
  recommendBaseMode,
  seasonFor,
  tripDraftSchema,
  tripEndDate,
  tripPreferencesSchema,
} from "@/lib/planner/types";
import { allErrors, applyStepDefault, stepErrors } from "@/lib/wizard/validate";
import { nextStep, prevStep, wizardSteps } from "@/lib/wizard/steps";

const today = new Date("2026-09-04T10:00:00");

describe("TripPreferences", () => {
  it("defaults are a valid draft but not a complete trip (no destination yet)", () => {
    const prefs = defaultTripPreferences(today);
    expect(tripDraftSchema.safeParse(prefs).success).toBe(true);
    expect(tripPreferencesSchema.safeParse(prefs).success).toBe(false);
    expect(tripPreferencesSchema.safeParse({ ...prefs, destinations: [{ countryCode: "PT", cities: [] }] }).success).toBe(true);
    expect(prefs.dates.start).toBe("2026-10-16");
  });

  it("rejects more seniors than adults and more than 3 destinations", () => {
    const prefs = defaultTripPreferences(today);
    expect(tripPreferencesSchema.safeParse({ ...prefs, party: { ...prefs.party, adults: 1, seniors: 2 } }).success).toBe(false);
    const four = ["PT", "IT", "JP", "FR"].map((countryCode) => ({ countryCode, cities: [] }));
    expect(tripPreferencesSchema.safeParse({ ...prefs, destinations: four }).success).toBe(false);
  });

  it("computes the end date inclusively", () => {
    expect(tripEndDate({ start: "2026-12-30", days: 3 })).toBe("2027-01-01");
    expect(tripEndDate({ start: "2026-05-01", days: 1 })).toBe("2026-05-01");
  });

  it("flips seasons in the southern hemisphere", () => {
    expect(seasonFor("2026-07-15", 38.7)).toBe("summer");
    expect(seasonFor("2026-07-15", -33.9)).toBe("winter");
    expect(seasonFor("2026-03-01", 35.7)).toBe("spring");
  });
});

describe("recommendBaseMode", () => {
  const base = defaultTripPreferences(today);
  const with_ = (p: Partial<typeof base>) => ({ ...base, ...p });

  it("one country, short trip -> single base", () => {
    const r = recommendBaseMode(with_({ destinations: [{ countryCode: "PT", cities: [] }], dates: { ...base.dates, days: 3 } }));
    expect(r).toEqual({ mode: "single", reason: "short" });
  });

  it("several countries -> multi", () => {
    const r = recommendBaseMode(
      with_({ destinations: [{ countryCode: "PT", cities: [] }, { countryCode: "IT", cities: [] }] }),
    );
    expect(r.mode).toBe("multi");
  });

  it("three areas in one country -> multi, unless small kids and short", () => {
    const three = [{ countryCode: "PT", cities: ["lisbon", "sintra", "porto"] }];
    expect(recommendBaseMode(with_({ destinations: three })).mode).toBe("multi");
  });

  it("small kids in one city -> single", () => {
    const r = recommendBaseMode(
      with_({
        destinations: [{ countryCode: "JP", cities: ["tokyo", "kamakura-hakone"] }],
        party: { ...base.party, childrenAges: [3] },
      }),
    );
    expect(r).toEqual({ mode: "single", reason: "small_kids" });
  });
});

describe("wizard validation", () => {
  const prefs = defaultTripPreferences(today);

  it("requires a destination", () => {
    expect(stepErrors("destination", prefs, today)).toEqual(["destination.required"]);
    expect(stepErrors("destination", { ...prefs, destinations: [{ countryCode: "PT", cities: [] }] }, today)).toEqual([]);
  });

  it("rejects past dates", () => {
    expect(stepErrors("dates", { ...prefs, dates: { ...prefs.dates, start: "2026-09-03" } }, today)).toEqual(["dates.pastDate"]);
    expect(stepErrors("dates", { ...prefs, dates: { ...prefs.dates, start: "2026-09-04" } }, today)).toEqual([]);
  });

  it("needs at least one transport mode and one interest", () => {
    const none = { walk: 0, bike: 0, car: 0, transit: 0, tours: 0 };
    expect(stepErrors("transport", { ...prefs, transport: none }, today)).toEqual(["transport.atLeastOne"]);
    expect(stepErrors("interests", { ...prefs, interests: [] }, today)).toEqual(["interests.atLeastOne"]);
  });

  it("collects errors per step for the summary", () => {
    const errs = allErrors({ ...prefs, interests: [] }, today);
    expect(Object.keys(errs).sort()).toEqual(["destination", "interests"]);
  });

  it("skip restores only that step's defaults", () => {
    const changed = { ...prefs, effort: "high" as const, interests: ["wine" as const], accessibility: ["stairs" as const] };
    const after = applyStepDefault("pace", changed);
    expect(after.effort).toBe("medium");
    expect(after.accessibility).toEqual([]);
    expect(after.interests).toEqual(["wine"]);
  });
});

describe("wizard steps", () => {
  it("has 10 steps starting with destination and ending with summary", () => {
    expect(wizardSteps.length).toBe(11);
    expect(wizardSteps[0]).toBe("destination");
    expect(wizardSteps[1]).toBe("wishlist");
    expect(wizardSteps[10]).toBe("summary");
    expect(prevStep("destination")).toBeNull();
    expect(nextStep("summary")).toBeNull();
    expect(nextStep("destination")).toBe("wishlist");
    expect(nextStep("wishlist")).toBe("dates");
  });
});
