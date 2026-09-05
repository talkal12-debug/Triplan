import { addDays, alignWithWeather, assignClusters, type DayPlan } from "./assign";
import { computeBudgets, type DayBudget } from "./budgets";
import { clusterEpsKm, clusterPlaces, type Cluster } from "./clustering";
import type { Itinerary, ItineraryDay, PlannerInput, PlannerPlace, Warning } from "./itinerary";
import { filterAndScore, type ScoredPlace } from "./scoring";
import { scheduleDay } from "./schedule";
import { planStays } from "./stays";
import { validateItinerary } from "./validate";
import { reorderForVariety } from "./variety";

export * from "./types";
export * from "./itinerary";
export { computeBudgets } from "./budgets";
export { scorePlace, exclusionReason } from "./scoring";
export { validateItinerary } from "./validate";

export class PlannerError extends Error {
  constructor(
    message: string,
    public readonly warnings: Warning[],
  ) {
    super(message);
    this.name = "PlannerError";
  }
}

export type PlannerResult = {
  itinerary: Itinerary;
  diagnostics: {
    budget: DayBudget;
    excluded: { placeId: string; reason: string }[];
    /** Places that did not make it, best first. Feeds "swap" suggestions. */
    unused: string[];
  };
};

const MAX_REPAIRS = 8;

/**
 * TripPreferences + places -> Itinerary. Pure and deterministic.
 * Throws PlannerError only when there is nothing to plan with.
 */
export function generateItinerary(input: PlannerInput): PlannerResult {
  const { prefs, cities, weather, holidays } = input;
  const budget = computeBudgets(prefs);
  const placesById = new Map(input.places.map((p) => [p.id, p]));

  // 1-3. Filter, score, cluster per city.
  const { scored, excluded } = filterAndScore(input.places, prefs);
  const byCity = new Map<string, ScoredPlace[]>();
  for (const s of scored) byCity.set(s.place.city, [...(byCity.get(s.place.city) ?? []), s]);
  const clustersByCity = new Map<string, Cluster[]>();
  for (const [city, items] of byCity) clustersByCity.set(city, clusterPlaces(items, city, clusterEpsKm(prefs)));

  // 4. Where do we sleep, which city each day.
  const stayPlan = planStays(prefs, cities, clustersByCity, budget);
  if (stayPlan.stays.length === 0) {
    throw new PlannerError("No places available for the chosen destinations", stayPlan.warnings);
  }

  // 5. Clusters -> days, then weather and variety passes.
  const assigned = assignClusters(stayPlan.slots, clustersByCity, budget, prefs);
  let dayPlans = alignWithWeather(assigned.days, weather);
  dayPlans = reorderForVariety(dayPlans, budget.walkKmMax);
  const pool = assigned.pool;

  // 6. Timetable per day, with repair loop.
  const stayById = new Map(stayPlan.stays.map((s) => [s.id, s]));
  const cityCenter = new Map(cities.map((c) => [c.slug, c.center]));
  const days: ItineraryDay[] = [];
  for (const plan of dayPlans) {
    const stay = stayById.get(plan.stayId)!;
    const base = plan.isDayTrip ? (cityCenter.get(plan.citySlug) ?? stay.center) : stay.center;
    const cityPool = pool.get(plan.citySlug) ?? [];
    let current: DayPlan = plan;
    // Wished places that did not fit an earlier day get another chance today.
    const mustPending = cityPool.filter((c) => prefs.mustVisit.some((m) => m.placeId === c.place.id) && !current.candidates.some((x) => x.place.id === c.place.id));
    if (mustPending.length) {
      for (const c of mustPending) cityPool.splice(cityPool.indexOf(c), 1);
      current = { ...current, candidates: [...mustPending, ...current.candidates] };
    }
    let result = scheduleDay(current, { prefs, budget, base, pool: cityPool });
    let attempts = 0;
    while (attempts++ < MAX_REPAIRS) {
      const check = validateItinerary(
        { version: 1, generatedAt: "", baseMode: stayPlan.baseMode, stays: stayPlan.stays, days: [result.day], warnings: [], stats: { totalWalkKm: 0, places: 0, verifiedShare: 0 } },
        placesById,
        budget,
      );
      if (check.errors.length === 0) break;
      // Repair: drop the lowest-scoring unlocked visit and try again.
      const visits = result.day.activities.filter((a) => a.kind === "visit" && !a.locked);
      if (visits.length === 0) break;
      const worst = visits
        .map((a) => ({ a, s: current.candidates.find((c) => c.place.id === a.placeId)?.score ?? 0 }))
        .sort((x, y) => x.s - y.s)[0].a;
      current = { ...current, candidates: current.candidates.filter((c) => c.place.id !== worst.placeId) };
      result = scheduleDay(current, { prefs, budget, base, pool: cityPool });
    }
    // Leftovers go back to the pool for later days in the same city.
    cityPool.push(...result.leftovers.filter((l) => !cityPool.includes(l)));
    cityPool.sort((a, b) => b.score - a.score);
    days.push(result.day);
  }

  // 7. Trip-level warnings.
  const warnings: Warning[] = [...stayPlan.warnings];
  const emptyFullDays = days.filter((d) => d.kind === "full" && !d.activities.some((a) => a.kind === "visit"));
  if (emptyFullDays.length) {
    warnings.push({ code: "few_places_left", severity: "warning", params: { days: emptyFullDays.length } });
  }
  for (const h of holidays ?? []) {
    const idx = days.findIndex((d) => d.date === h.date);
    if (idx >= 0) warnings.push({ code: "holiday", severity: "warning", params: { name: h.name, date: h.date }, dayIndex: idx });
  }
  if (weather) {
    for (const d of days) {
      const w = weather[d.date];
      if (w && w.precipProbability >= 60) warnings.push({ code: "rain_expected", severity: "info", params: { probability: w.precipProbability }, dayIndex: d.index });
    }
  }

  // Wishlist: warn about entries that did not fit anywhere (the visit reason itself is set by the scheduler).
  const mustIds = new Set(prefs.mustVisit.map((m) => m.placeId).filter((id): id is string => Boolean(id)));
  if (mustIds.size) {
    const placed = new Set(days.flatMap((d) => d.activities.map((a) => a.placeId)));
    for (const m of prefs.mustVisit) {
      if (m.placeId && mustIds.has(m.placeId) && !placed.has(m.placeId)) warnings.push({ code: "must_visit_unplaced", severity: "warning", params: { name: m.name }, placeId: m.placeId });
    }
  }

  const used = days.flatMap((d) => d.activities.filter((a) => a.kind === "visit").map((a) => a.placeId!));
  const verified = used.filter((id) => placesById.get(id)?.dataQuality === "verified").length;
  const itinerary: Itinerary = {
    version: 1,
    generatedAt: new Date().toISOString(),
    baseMode: stayPlan.baseMode,
    stays: stayPlan.stays,
    days,
    warnings,
    stats: {
      totalWalkKm: Math.round(days.reduce((s, d) => s + d.stats.walkKm, 0) * 10) / 10,
      places: used.length,
      verifiedShare: used.length ? Math.round((verified / used.length) * 100) / 100 : 0,
    },
  };

  const final = validateItinerary(itinerary, placesById, budget);
  if (final.errors.length) {
    throw new PlannerError(`Plan failed validation: ${final.errors.map((e) => `${e.code}@${e.dayIndex}`).join(", ")}`, final.errors);
  }
  itinerary.warnings.push(...final.warnings);

  const usedSet = new Set(used);
  const unused = scored.filter((s) => !usedSet.has(s.place.id)).map((s) => s.place.id);
  return {
    itinerary,
    diagnostics: {
      budget,
      excluded: excluded.map((e) => ({ placeId: e.place.id, reason: e.reason })),
      unused,
    },
  };
}

export { addDays };
export type { PlannerPlace };
