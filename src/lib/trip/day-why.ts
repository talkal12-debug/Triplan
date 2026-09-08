import type { GuestPlan } from "@/lib/guest/trips";
import type { ItineraryDay } from "@/lib/planner/itinerary";

type Texts = {
  compact: (maxMinutes: number) => string;
  timed: (count: number) => string;
  rain: (count: number) => string;
  wishes: (count: number) => string;
};

/**
 * "Why this day looks like this", in one or two short lines, from what the plan
 * already knows: how tight the walking is, how many stops are pinned to this day
 * or hour by their opening times, how many are indoors on a rainy day, how many
 * came from the wishlist. Nothing is guessed; empty when there is nothing to say.
 */
export function dayWhyLines(plan: GuestPlan, day: ItineraryDay, t: Texts): string[] {
  const visits = day.activities.filter((a) => a.kind === "visit");
  if (visits.length < 2) return [];
  const lines: string[] = [];
  const legs = visits.slice(1).map((a) => a.transitFromPrev?.minutes ?? null).filter((m): m is number => m !== null);
  const maxLeg = legs.length ? Math.max(...legs) : null;
  if (maxLeg !== null && maxLeg <= 20) lines.push(t.compact(maxLeg));
  const timed = visits.filter((a) => a.reasons.some((r) => r.code === "closes_early" || r.code === "opens_late" || r.code === "closed_other_days")).length;
  if (timed > 0) lines.push(t.timed(timed));
  const rainy = (plan.extras?.weather[day.date]?.precipProbability ?? 0) >= 50;
  const indoor = visits.filter((a) => a.placeId && plan.places[a.placeId]?.indoor).length;
  if (rainy && indoor >= 2) lines.push(t.rain(indoor));
  const wishes = visits.filter((a) => a.reasons.some((r) => r.code === "must_visit")).length;
  if (wishes > 0) lines.push(t.wishes(wishes));
  return lines;
}
