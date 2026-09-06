import type { DayBudget } from "./budgets";
import { haversineKm } from "./geo";
import type { Itinerary, PlannerPlace, Warning } from "./itinerary";
import { openState } from "./opening";

export type ValidationResult = { errors: Warning[]; warnings: Warning[] };

/** Consecutive visits further apart than this (straight line) are a "zig-zag" unless it is a day trip. */
const MAX_JUMP_KM = 12;

/**
 * Sanity check every generated plan must pass. Errors mean the plan is not shippable;
 * the generator repairs and re-validates until there are none.
 */
export function validateItinerary(it: Itinerary, places: Map<string, PlannerPlace>, budget: DayBudget): ValidationResult {
  const errors: Warning[] = [];
  const warnings: Warning[] = [];
  const seen = new Set<string>();

  for (const day of it.days) {
    let lastEnd = -1;
    let lastPlace: PlannerPlace | null = null;

    if (day.stats.walkKm > budget.walkKmMax + 0.05) {
      errors.push({ code: "day_too_full", severity: "error", params: { walkKm: day.stats.walkKm, max: budget.walkKmMax }, dayIndex: day.index });
    }
    if (day.stats.load > 1.001) {
      errors.push({ code: "day_too_full", severity: "error", params: { load: day.stats.load }, dayIndex: day.index });
    }
    if (day.stats.museums > budget.maxMuseums) {
      warnings.push({ code: "day_too_full", severity: "warning", params: { museums: day.stats.museums }, dayIndex: day.index });
    }

    for (const a of day.activities) {
      if (a.startMin < lastEnd) {
        errors.push({ code: "day_too_full", severity: "error", params: { overlap: a.id }, dayIndex: day.index });
      }
      // Only visits must end within the day: a late flight puts the hotel check-in after it, and that is fine.
      if (a.kind === "visit" && a.endMin > budget.dayEnd + 30) {
        errors.push({ code: "day_too_full", severity: "error", params: { late: a.id }, dayIndex: day.index });
      }
      lastEnd = a.endMin;
      if (a.kind !== "visit" || !a.placeId) continue;

      if (seen.has(a.placeId)) {
        errors.push({ code: "day_too_full", severity: "error", params: { duplicate: a.placeId }, dayIndex: day.index, placeId: a.placeId });
      }
      seen.add(a.placeId);

      const place = places.get(a.placeId);
      if (!place) {
        errors.push({ code: "no_places", severity: "error", params: { place: a.placeId }, dayIndex: day.index, placeId: a.placeId });
        continue;
      }
      if (openState(place, day.date, a.startMin) === "closed") {
        errors.push({ code: "closed_on_date", severity: "error", params: { place: a.placeId }, dayIndex: day.index, placeId: a.placeId });
      }
      if (lastPlace && haversineKm(lastPlace, place) > MAX_JUMP_KM) {
        errors.push({ code: "day_too_full", severity: "error", params: { jump: a.placeId, km: Math.round(haversineKm(lastPlace, place)) }, dayIndex: day.index, placeId: a.placeId });
      }
      lastPlace = place;
    }
  }

  return { errors, warnings };
}
