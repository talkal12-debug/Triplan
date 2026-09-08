import type { ItineraryDay } from "@/lib/planner/itinerary";
import type { Traveler } from "@/lib/planner/types";

export type FitIssue = "walk" | "heavy" | "rest" | "access" | "accessLimited";
export type TravelerFit = { traveler: Traveler; issues: FitIssue[] };

type PlaceInfo = { wheelchair?: "yes" | "limited" | "no" | "unknown" };

const WALK_LIMIT_KM = 5;
const LONG_DAY_MIN = 5 * 60;

/**
 * Does this day suit every traveller? Judged only from what the plan states:
 * walking distance and intensity for people who walk little (65+, "little
 * walking"), a break in a long day for small children and infants, and the
 * places' wheelchair tag for wheelchairs and strollers. Travellers with no
 * issue are not listed; nothing here is a medical judgement.
 */
export function dayFit(day: ItineraryDay, places: Record<string, PlaceInfo>, travelers: Traveler[]): TravelerFit[] {
  if (travelers.length === 0) return [];
  const visits = day.activities.filter((a) => a.kind === "visit");
  if (visits.length === 0) return [];
  const walkKm = day.stats.walkKm;
  const heavy = day.stats.intensity === "heavy";
  const first = Math.min(...day.activities.map((a) => a.startMin));
  const last = Math.max(...day.activities.map((a) => a.endMin));
  const hasBreak = day.activities.some((a) => a.kind === "rest" || a.kind === "meal");
  const longWithoutBreak = last - first >= LONG_DAY_MIN && !hasBreak;
  const noAccess = visits.filter((a) => a.placeId && places[a.placeId]?.wheelchair === "no").length;
  const limitedAccess = visits.filter((a) => a.placeId && places[a.placeId]?.wheelchair === "limited").length;

  const out: TravelerFit[] = [];
  for (const tr of travelers) {
    const issues: FitIssue[] = [];
    const walksLittle = tr.kind === "senior" || tr.needs.includes("lowWalking");
    const small = tr.kind === "infant" || (tr.kind === "child" && (tr.age ?? 8) < 6) || tr.needs.includes("naps");
    const wheels = tr.needs.includes("wheelchair") || tr.needs.includes("stroller");
    if ((walksLittle || small) && walkKm > WALK_LIMIT_KM) issues.push("walk");
    if (walksLittle && heavy) issues.push("heavy");
    if (small && longWithoutBreak) issues.push("rest");
    if (wheels && noAccess > 0) issues.push("access");
    else if (wheels && limitedAccess > 0) issues.push("accessLimited");
    if (issues.length > 0) out.push({ traveler: tr, issues });
  }
  return out;
}
