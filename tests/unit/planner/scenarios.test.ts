import { describe, expect, it } from "vitest";
import { computeBudgets, generateItinerary, type Itinerary } from "@/lib/planner";
import { assertInvariants, loadMany, prefsFor, visitIds } from "./helpers";

function placesOf(it: Itinerary, all: ReturnType<typeof loadMany>["places"]) {
  const byId = new Map(all.map((p) => [p.id, p]));
  return visitIds(it).map((id) => byId.get(id)!);
}

describe("scenario: family with a baby and a 5-year-old, Lisbon, little walking", () => {
  const data = loadMany(["PT"]);
  const prefs = prefsFor({
    destinations: [{ countryCode: "PT", cities: ["lisbon"] }],
    dates: { start: "2026-10-16", days: 6, arrivalTime: "10:00", departureTime: "19:00" },
    party: { adults: 2, childrenAges: [5], infants: 1, stroller: true, seniors: 0 },
    effort: "low",
    interests: ["kids", "nature", "food"],
  });
  const { itinerary, diagnostics } = generateItinerary({ prefs, places: data.places, cities: data.cities });
  const chosen = placesOf(itinerary, data.places);

  it("satisfies the invariants", () => {
    assertInvariants(itinerary, prefs, data.places);
  });

  it("never exceeds 4 km walking a day and keeps days short", () => {
    const budget = computeBudgets(prefs);
    expect(budget.walkKmMax).toBeLessThanOrEqual(4);
    for (const day of itinerary.days) expect(day.stats.walkKm).toBeLessThanOrEqual(4);
    expect(budget.dayStart).toBe(9 * 60 + 30);
  });

  it("excludes places with age limits, no-stroller places and nightlife", () => {
    for (const p of chosen) {
      expect(p.minAge === null || p.minAge <= 0, p.id).toBe(true);
      expect(p.strollerOk !== false, p.id).toBe(true);
      expect(p.category, p.id).not.toBe("nightlife");
    }
    expect(diagnostics.excluded.some((e) => e.reason === "min_age")).toBe(true);
    expect(diagnostics.excluded.some((e) => e.reason === "stroller")).toBe(true);
  });

  it("schedules rest breaks and at most 2 museums a day", () => {
    const fullDays = itinerary.days.filter((d) => d.kind === "full");
    expect(fullDays.some((d) => d.activities.some((a) => a.kind === "rest"))).toBe(true);
    for (const day of itinerary.days) expect(day.stats.museums).toBeLessThanOrEqual(2);
  });

  it("makes arrival and departure days light and starts after the flight", () => {
    const first = itinerary.days[0];
    const last = itinerary.days[itinerary.days.length - 1];
    expect(first.kind).toBe("arrival");
    expect(last.kind).toBe("departure");
    expect(first.activities[0].startMin).toBeGreaterThanOrEqual(12 * 60);
    expect(first.stats.activeMinutes).toBeLessThanOrEqual(computeBudgets(prefs).activeMinutes * 0.5 + 1);
    expect(Math.max(...last.activities.map((a) => a.endMin))).toBeLessThanOrEqual(16 * 60);
  });

  it("prefers kid-friendly places and explains it", () => {
    const kidFriendlyShare = chosen.filter((p) => p.kidFriendly).length / chosen.length;
    expect(kidFriendlyShare).toBeGreaterThan(0.85);
    const withReason = itinerary.days.flatMap((d) => d.activities).filter((a) => a.reasons.some((r) => r.code === "kid_friendly"));
    expect(withReason.length).toBeGreaterThan(0);
  });
});

describe("scenario: couple in their 70s, Rome, stairs are hard", () => {
  const data = loadMany(["IT"]);
  const prefs = prefsFor({
    destinations: [{ countryCode: "IT", cities: ["rome"] }],
    dates: { start: "2026-10-16", days: 5, arrivalTime: null, departureTime: null },
    party: { adults: 2, childrenAges: [], infants: 0, stroller: false, seniors: 2 },
    effort: "low",
    accessibility: ["stairs"],
    interests: ["history", "religion", "food"],
    transport: { walk: 2, bike: 0, car: 0, transit: 3, tours: 2 },
  });
  const { itinerary } = generateItinerary({ prefs, places: data.places, cities: data.cities });

  it("satisfies the invariants with a tight walking budget", () => {
    assertInvariants(itinerary, prefs, data.places);
    expect(computeBudgets(prefs).walkKmMax).toBeLessThanOrEqual(5);
    for (const day of itinerary.days) expect(day.stats.walkKm).toBeLessThanOrEqual(5);
  });

  it("uses public transport for longer hops instead of walking", () => {
    const transits = itinerary.days.flatMap((d) => d.activities).map((a) => a.transitFromPrev).filter(Boolean);
    expect(transits.some((t) => t!.mode === "transit")).toBe(true);
    for (const t of transits) expect(t!.mode === "walk" ? t!.meters : 0).toBeLessThanOrEqual(1400);
  });

  it("still visits the icons of Rome", () => {
    const ids = visitIds(itinerary);
    expect(ids.filter((id) => ["it-rome-colosseo", "it-rome-pantheon", "it-rome-fontana-di-trevi", "it-rome-basilica-di-san-pietro"].includes(id)).length).toBeGreaterThanOrEqual(2);
  });
});

describe("scenario: sporty couple, third time in Tokyo", () => {
  const data = loadMany(["JP"]);
  const base = {
    destinations: [{ countryCode: "JP", cities: ["tokyo"] }],
    dates: { start: "2026-10-16", days: 7, arrivalTime: null, departureTime: null },
    effort: "high" as const,
    interests: ["nature", "adventure", "photography", "food", "local"].filter((i) => i !== "local") as ("nature" | "adventure" | "photography" | "food")[],
  };
  const third = prefsFor({ ...base, visitNumber: 3 });
  const first = prefsFor({ ...base, visitNumber: 1 });
  const planThird = generateItinerary({ prefs: third, places: data.places, cities: data.cities }).itinerary;
  const planFirst = generateItinerary({ prefs: first, places: data.places, cities: data.cities }).itinerary;

  it("satisfies the invariants and walks a lot", () => {
    assertInvariants(planThird, third, data.places);
    expect(computeBudgets(third).walkKmMax).toBe(20);
    expect(planThird.stats.totalWalkKm).toBeGreaterThan(planFirst.stats.totalWalkKm * 0.6);
  });

  it("picks less iconic, more local places than a first-timer would", () => {
    const iconicity = (it: Itinerary) => {
      const ps = placesOf(it, data.places);
      return ps.reduce((s, p) => s + p.iconicity, 0) / ps.length;
    };
    expect(iconicity(planThird)).toBeLessThan(iconicity(planFirst));
    const hidden = placesOf(planThird, data.places).filter((p) => p.tags.includes("hidden") || p.tags.includes("local")).length;
    expect(hidden).toBeGreaterThanOrEqual(3);
    expect(planThird.days.flatMap((d) => d.activities).some((a) => a.reasons.some((r) => r.code === "hidden_gem_returning"))).toBe(true);
  });

  it("packs more places per day than the family plan would", () => {
    const perDay = planThird.stats.places / planThird.days.length;
    expect(perDay).toBeGreaterThanOrEqual(3);
  });
});

describe("scenario: group of four with a rental car, all of Portugal, moving route", () => {
  const data = loadMany(["PT"]);
  const prefs = prefsFor({
    destinations: [{ countryCode: "PT", cities: ["lisbon", "sintra", "porto"] }],
    dates: { start: "2026-10-16", days: 8, arrivalTime: null, departureTime: null },
    party: { adults: 4, childrenAges: [], infants: 0, stroller: false, seniors: 0 },
    transport: { walk: 2, bike: 0, car: 3, transit: 1, tours: 0 },
    hotel: { type: "apartment", locationPref: "quiet", baseMode: "multi" },
    interests: ["wine", "food", "nature", "history"],
  });
  const { itinerary } = generateItinerary({ prefs, places: data.places, cities: data.cities });

  it("satisfies the invariants", () => {
    assertInvariants(itinerary, prefs, data.places);
  });

  it("sleeps in more than one city, changes hotel in the morning and never on the first day", () => {
    expect(itinerary.baseMode).toBe("multi");
    expect(itinerary.stays.length).toBeGreaterThanOrEqual(2);
    const transfers = itinerary.days.filter((d) => d.activities.some((a) => a.kind === "hotel_checkout"));
    expect(transfers.length).toBe(itinerary.stays.length - 1);
    for (const d of transfers) {
      expect(d.index).toBeGreaterThan(0);
      expect(d.activities[0].kind).toBe("hotel_checkout");
    }
    // Porto and Lisbon are both slept in.
    expect(itinerary.stays.map((s) => s.citySlug)).toEqual(expect.arrayContaining(["lisbon", "porto"]));
  });

  it("uses the car for longer hops", () => {
    const modes = itinerary.days.flatMap((d) => d.activities).map((a) => a.transitFromPrev?.mode).filter(Boolean);
    expect(modes).toContain("car");
  });

  it("gets to the Porto wine cellars", () => {
    expect(visitIds(itinerary).some((id) => id.includes("caves-taylors") || id.includes("wow-porto"))).toBe(true);
  });
});

describe("single base with day trips", () => {
  const data = loadMany(["PT"]);
  const prefs = prefsFor({
    destinations: [{ countryCode: "PT", cities: ["lisbon", "sintra"] }],
    dates: { start: "2026-10-16", days: 6, arrivalTime: null, departureTime: null },
    hotel: { type: "4star", locationPref: "center", baseMode: "single" },
  });
  const { itinerary } = generateItinerary({ prefs, places: data.places, cities: data.cities });

  it("keeps one hotel and makes Sintra a full day trip in the middle", () => {
    assertInvariants(itinerary, prefs, data.places);
    expect(itinerary.stays.length).toBe(1);
    const trip = itinerary.days.filter((d) => d.citySlug === "sintra");
    expect(trip.length).toBe(1);
    expect(trip[0].index).toBeGreaterThan(0);
    expect(trip[0].index).toBeLessThan(5);
    expect(trip[0].activities.some((a) => a.reasons.some((r) => r.code === "day_trip"))).toBe(true);
  });

  it("drops Porto as a day trip when it is too far from Lisbon, with a warning", () => {
    const far = prefsFor({ ...prefs, destinations: [{ countryCode: "PT", cities: ["lisbon", "porto"] }] });
    const { itinerary: it2 } = generateItinerary({ prefs: far, places: data.places, cities: data.cities });
    expect(it2.stays.length).toBe(1);
    expect(it2.warnings.some((w) => w.code === "base_too_far")).toBe(true);
    expect(it2.days.every((d) => d.citySlug === "lisbon")).toBe(true);
  });
});

describe("weather and holidays", () => {
  const data = loadMany(["PT"]);
  const prefs = prefsFor({
    destinations: [{ countryCode: "PT", cities: ["lisbon"] }],
    dates: { start: "2026-10-16", days: 6, arrivalTime: null, departureTime: null },
    interests: ["museums", "history", "city"],
  });

  it("moves indoor-heavy content onto rainy days and warns about holidays", () => {
    const dry = generateItinerary({ prefs, places: data.places, cities: data.cities }).itinerary;
    const weather = { "2026-10-18": { precipProbability: 85, tempMax: 17 } };
    const holidays = [{ date: "2026-10-19", name: "Test holiday" }];
    const wet = generateItinerary({ prefs, places: data.places, cities: data.cities, weather, holidays }).itinerary;
    assertInvariants(wet, prefs, data.places);
    expect(wet.warnings.some((w) => w.code === "rain_expected" && w.dayIndex === 2)).toBe(true);
    expect(wet.warnings.some((w) => w.code === "holiday" && w.dayIndex === 3)).toBe(true);
    const outdoorOnRainyDay = wet.days[2].stats.outdoorShare;
    const outdoorSameDayDry = dry.days[2].stats.outdoorShare;
    expect(outdoorOnRainyDay).toBeLessThanOrEqual(outdoorSameDayDry + 0.001);
    expect(wet.days.every((d) => d.rainPlan.length > 0 || d.stats.outdoorShare === 0 || d.kind !== "full")).toBe(true);
  });
});

describe("determinism and variety", () => {
  const data = loadMany(["IT"]);
  const prefs = prefsFor({
    destinations: [{ countryCode: "IT", cities: ["rome"] }],
    dates: { start: "2026-10-16", days: 7, arrivalTime: null, departureTime: null },
  });

  it("produces the same plan for the same input", () => {
    const a = generateItinerary({ prefs, places: data.places, cities: data.cities }).itinerary;
    const b = generateItinerary({ prefs, places: data.places, cities: data.cities }).itinerary;
    expect(visitIds(a)).toEqual(visitIds(b));
  });

  it("varies the days: not every day is heavy, and themes alternate", () => {
    const it = generateItinerary({ prefs, places: data.places, cities: data.cities }).itinerary;
    const full = it.days.filter((d) => d.kind === "full");
    expect(full.some((d) => d.stats.intensity !== "heavy")).toBe(true);
    let sameThemePairs = 0;
    for (let i = 1; i < full.length; i++) if (full[i - 1].theme === full[i].theme) sameThemePairs += 1;
    expect(sameThemePairs).toBeLessThanOrEqual(Math.floor(full.length / 2));
  });

  it("gives every visit at least one reason", () => {
    const it = generateItinerary({ prefs, places: data.places, cities: data.cities }).itinerary;
    for (const a of it.days.flatMap((d) => d.activities).filter((a) => a.kind === "visit")) {
      expect(a.reasons.length).toBeGreaterThan(0);
    }
  });
});
