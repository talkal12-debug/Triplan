import { RELAX_CAPACITY, RELAX_WALK } from "@/lib/planner/schedule";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { poisFileSchema, type PoisFile } from "@/lib/data/schemas";
import { computeBudgets, defaultTripPreferences, type TripPreferences } from "@/lib/planner";
import type { Itinerary, PlannerPlace } from "@/lib/planner";

const cache = new Map<string, PoisFile>();

export function loadPois(code: string): PoisFile {
  const key = code.toLowerCase();
  if (!cache.has(key)) {
    cache.set(key, poisFileSchema.parse(JSON.parse(readFileSync(join(process.cwd(), "data", "pois", `${key}.json`), "utf8"))));
  }
  return cache.get(key)!;
}

export function loadMany(codes: string[]): { places: PlannerPlace[]; cities: PoisFile["cities"] } {
  const files = codes.map(loadPois);
  return { places: files.flatMap((f) => f.places), cities: files.flatMap((f) => f.cities) };
}

export const TODAY = new Date("2026-09-04T10:00:00");

export function prefsFor(overrides: Partial<TripPreferences> & { destinations: TripPreferences["destinations"] }): TripPreferences {
  const base = defaultTripPreferences(TODAY);
  return {
    ...base,
    ...overrides,
    dates: { ...base.dates, start: "2026-10-16", ...(overrides.dates ?? {}) },
    party: { ...base.party, ...(overrides.party ?? {}) },
    transport: { ...base.transport, ...(overrides.transport ?? {}) },
    budget: { ...base.budget, ...(overrides.budget ?? {}) },
    hotel: { ...base.hotel, ...(overrides.hotel ?? {}) },
  };
}

export function visitIds(it: Itinerary): string[] {
  return it.days.flatMap((d) => d.activities.filter((a) => a.kind === "visit").map((a) => a.placeId!));
}

/** Invariants every plan must satisfy, regardless of scenario. */
export function assertInvariants(it: Itinerary, prefs: TripPreferences, places: PlannerPlace[]) {
  const budget = computeBudgets(prefs);
  const byId = new Map(places.map((p) => [p.id, p]));
  const ids = visitIds(it);
  if (new Set(ids).size !== ids.length) throw new Error("a place appears twice");
  if (it.days.length !== prefs.dates.days) throw new Error(`expected ${prefs.dates.days} days, got ${it.days.length}`);
  it.days.forEach((day, i) => {
    if (day.index !== i) throw new Error("day index mismatch");
    // Filling a day may stretch the budgets by the same factors the validator allows.
    if (day.stats.walkKm > budget.walkKmMax * RELAX_WALK + 0.05) throw new Error(`day ${i} walks ${day.stats.walkKm} > ${budget.walkKmMax}`);
    if (day.stats.load > RELAX_CAPACITY + 0.05) throw new Error(`day ${i} overloaded ${day.stats.load}`);
    let last = -1;
    for (const a of day.activities) {
      if (a.startMin < last) throw new Error(`day ${i} overlapping activities`);
      if (a.endMin < a.startMin) throw new Error("negative duration");
      last = a.endMin;
      if (a.kind === "visit" && !byId.has(a.placeId!)) throw new Error(`unknown place ${a.placeId}`);
    }
  });
  const stayDays = it.stays.flatMap((s) => Array.from({ length: s.toDay - s.fromDay + 1 }, (_, k) => s.fromDay + k));
  if (stayDays.length !== prefs.dates.days || new Set(stayDays).size !== prefs.dates.days) throw new Error("stays do not cover the trip exactly");
}
