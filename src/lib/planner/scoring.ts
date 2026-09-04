import type { TripPreferences } from "./types";
import type { PlannerPlace } from "./itinerary";
import { hasChildren } from "./budgets";

/** Why a place was excluded, for diagnostics. */
export type ExclusionReason =
  | "already_seen"
  | "min_age"
  | "wheelchair"
  | "stroller"
  | "nightlife_with_kids"
  | "price";

/**
 * Hard filters. A place that fails any of these never appears in the plan.
 */
export function exclusionReason(place: PlannerPlace, prefs: TripPreferences): ExclusionReason | null {
  if (prefs.alreadySeen.includes(place.id)) return "already_seen";
  const youngest = Math.min(...prefs.party.childrenAges, prefs.party.infants > 0 ? 0 : 99);
  if (place.minAge !== null && youngest < place.minAge) return "min_age";
  if (prefs.accessibility.includes("wheelchair") && place.wheelchair === "no") return "wheelchair";
  if ((prefs.accessibility.includes("stroller") || prefs.party.stroller) && place.strollerOk === false) return "stroller";
  if (hasChildren(prefs) && place.category === "nightlife") return "nightlife_with_kids";
  if (prefs.budget.level === "budget" && (place.priceLevel ?? 0) >= 4) return "price";
  return null;
}

const rankWeight = [1, 0.85, 0.7];

/**
 * 0..1 desirability. Deterministic; the same inputs always give the same score.
 */
export function scorePlace(place: PlannerPlace, prefs: TripPreferences): number {
  let score = 0;

  // Interest match: best-matching ranked interest counts most.
  let interest = 0;
  prefs.interests.forEach((tag, rank) => {
    if (place.tags.includes(tag)) {
      interest = Math.max(interest, rankWeight[rank] ?? 0.5);
    }
  });
  score += 0.45 * interest;

  // First-timers want icons; third-timers want the opposite.
  const icon = place.iconicity;
  if (prefs.visitNumber === 1) score += 0.35 * icon;
  else if (prefs.visitNumber === 2) score += 0.2 * icon + 0.1 * (place.tags.includes("local") || place.tags.includes("hidden") ? 1 : 0);
  else score += 0.15 * (1 - icon) + 0.25 * (place.tags.includes("local") || place.tags.includes("hidden") ? 1 : 0);

  // Group fit.
  if (hasChildren(prefs)) {
    score += place.kidFriendly ? 0.12 : -0.15;
    if (place.tags.includes("kids")) score += 0.08;
  }
  if (prefs.party.seniors > 0 && place.wheelchair === "yes") score += 0.03;

  // Money.
  const price = place.priceLevel ?? 1;
  if (prefs.budget.level === "budget") score -= price * 0.05;
  if (prefs.budget.level === "luxury" && price >= 2) score += 0.03;

  // Trust: unverified places rank a little lower.
  if (place.dataQuality === "unverified") score -= 0.08;
  else if (place.dataQuality === "partial") score -= 0.02;

  return Math.max(0, Math.min(1, score));
}

export type ScoredPlace = { place: PlannerPlace; score: number };

export function filterAndScore(places: PlannerPlace[], prefs: TripPreferences): {
  scored: ScoredPlace[];
  excluded: { place: PlannerPlace; reason: ExclusionReason }[];
} {
  const scored: ScoredPlace[] = [];
  const excluded: { place: PlannerPlace; reason: ExclusionReason }[] = [];
  for (const place of places) {
    const reason = exclusionReason(place, prefs);
    if (reason) excluded.push({ place, reason });
    else scored.push({ place, score: scorePlace(place, prefs) });
  }
  scored.sort((a, b) => b.score - a.score || a.place.id.localeCompare(b.place.id));
  return { scored, excluded };
}
