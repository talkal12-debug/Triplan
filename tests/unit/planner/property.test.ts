import { describe, expect, it } from "vitest";
import { computeBudgets, generateItinerary, validateItinerary, type TripPreferences } from "@/lib/planner";
import { assertInvariants, loadMany, prefsFor } from "./helpers";

/** Tiny seeded PRNG so failures are reproducible. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const pick = <T>(r: () => number, xs: readonly T[]) => xs[Math.floor(r() * xs.length)];

function randomPrefs(r: () => number): TripPreferences {
  const country = pick(r, ["PT", "IT", "JP"] as const);
  const cityOptions = { PT: ["lisbon", "sintra", "porto"], IT: ["rome", "tivoli"], JP: ["tokyo", "kamakura-hakone"] }[country];
  const cities = cityOptions.filter(() => r() < 0.6);
  const kids = r() < 0.4 ? [Math.floor(r() * 16) + 2] : [];
  const adults = 1 + Math.floor(r() * 4);
  return prefsFor({
    destinations: [{ countryCode: country, cities }],
    dates: { start: "2026-10-16", days: 1 + Math.floor(r() * 10), arrivalTime: r() < 0.5 ? "12:00" : null, departureTime: r() < 0.5 ? "17:00" : null },
    party: { adults, childrenAges: kids, infants: r() < 0.2 ? 1 : 0, stroller: r() < 0.2, seniors: Math.min(adults, r() < 0.3 ? 1 : 0) },
    visitNumber: pick(r, [1, 2, 3] as const),
    effort: pick(r, ["low", "medium", "high"] as const),
    accessibility: r() < 0.2 ? ["stairs"] : [],
    transport: { walk: pick(r, [0, 2, 3]), bike: 0, car: pick(r, [0, 0, 3]), transit: pick(r, [0, 2, 3]), tours: 0 },
    interests: ["history", "food", "nature", "museums", "photography", "kids", "wine"].filter(() => r() < 0.5) as TripPreferences["interests"],
    hotel: { type: "3star", locationPref: "center", baseMode: pick(r, ["single", "multi", "auto"] as const) },
  });
}

describe("property: random travellers always get a valid plan", () => {
  const data = { PT: loadMany(["PT"]), IT: loadMany(["IT"]), JP: loadMany(["JP"]) };
  const r = rng(20260904);
  const cases = Array.from({ length: 40 }, (_, i) => ({ i, prefs: randomPrefs(r) }));

  it.each(cases)("case #$i", ({ prefs }) => {
    const fixed = {
      ...prefs,
      transport: Object.values(prefs.transport).every((w) => w === 0) ? { ...prefs.transport, walk: 2 } : prefs.transport,
      interests: prefs.interests.length ? prefs.interests : (["city"] as TripPreferences["interests"]),
    };
    const d = data[fixed.destinations[0].countryCode as "PT" | "IT" | "JP"];
    const { itinerary } = generateItinerary({ prefs: fixed, places: d.places, cities: d.cities });
    assertInvariants(itinerary, fixed, d.places);
    const check = validateItinerary(itinerary, new Map(d.places.map((p) => [p.id, p])), computeBudgets(fixed));
    expect(check.errors).toEqual([]);
    // Every full day has something to do, unless the destination genuinely ran out of places
    // (then the plan says so instead of pretending).
    const ranOut = itinerary.warnings.some((w) => w.code === "few_places_left");
    for (const day of itinerary.days) {
      if (day.kind === "full" && !ranOut) {
        const visits = day.activities.filter((a) => a.kind === "visit").length;
        expect(visits, `day ${day.index} (${day.citySlug}) empty for ${JSON.stringify(fixed)} -> ${JSON.stringify(day.warnings)}`).toBeGreaterThan(0);
      }
    }
    if (ranOut) {
      // Still, places must be spread: at most half the full days may be empty.
      const full = itinerary.days.filter((d) => d.kind === "full");
      const empty = full.filter((d) => !d.activities.some((a) => a.kind === "visit"));
      expect(empty.length, JSON.stringify(fixed.destinations)).toBeLessThanOrEqual(Math.ceil(full.length / 2));
    }
  });
});
