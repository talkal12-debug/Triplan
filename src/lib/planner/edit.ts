import { computeBudgets, type DayBudget } from "./budgets";
import { haversineKm } from "./geo";
import type { Itinerary, ItineraryDay, PlannerCity, PlannerPlace } from "./itinerary";
import { opensOnDate } from "./opening";
import { scorePlace, exclusionReason, type ScoredPlace } from "./scoring";
import { scheduleDay, type ScheduleContext } from "./schedule";
import { beachesNear } from "./beaches";
import type { DayPlan } from "./assign";
import type { TripPreferences } from "./types";

/**
 * Editing operations. All pure: they return a new Itinerary and never touch the input.
 * The UI (milestone 5) calls these; the AI chat (milestone 8) maps its structured
 * output onto the same functions.
 */
export type EditContext = {
  prefs: TripPreferences;
  places: PlannerPlace[];
  cities: PlannerCity[];
  budget?: DayBudget;
  travel?: ScheduleContext["travel"];
};

function budgetOf(ctx: EditContext): DayBudget {
  return ctx.budget ?? computeBudgets(ctx.prefs);
}

function placeMap(ctx: EditContext): Map<string, PlannerPlace> {
  return new Map(ctx.places.map((p) => [p.id, p]));
}

function usedPlaceIds(it: Itinerary): Set<string> {
  return new Set(it.days.flatMap((d) => d.activities.filter((a) => a.kind === "visit").map((a) => a.placeId!)));
}

function scored(place: PlannerPlace, ctx: EditContext): ScoredPlace {
  return { place, score: scorePlace(place, ctx.prefs) };
}

function baseFor(it: Itinerary, day: ItineraryDay, ctx: EditContext) {
  const stay = it.stays.find((s) => s.id === day.stayId)!;
  const isDayTrip = day.citySlug !== stay.citySlug;
  const city = ctx.cities.find((c) => c.slug === day.citySlug);
  return { center: isDayTrip && city ? city.center : stay.center, isDayTrip };
}

/** Re-time one day from an explicit ordered list of place ids (user order is kept). */
function rescheduleDay(
  it: Itinerary,
  day: ItineraryDay,
  placeIds: string[],
  ctx: EditContext,
  opts: { capacityScale?: number; walkScale?: number; keepAll?: boolean } = {},
): ItineraryDay {
  const places = placeMap(ctx);
  const base = budgetOf(ctx);
  // "Too light" asks for more than the default day, so the walking budget stretches with the capacity.
  const budget = opts.walkScale ? { ...base, walkKmMax: base.walkKmMax * opts.walkScale } : base;
  const { center, isDayTrip } = baseFor(it, day, ctx);
  const locked = new Set(day.activities.filter((a) => a.locked && a.placeId).map((a) => a.placeId!));
  // Re-timing (real travel times) must never drop a visit the traveller already has: every id is pinned for scheduling.
  const pinned = opts.keepAll ? new Set(placeIds) : locked;
  const candidates = placeIds.map((id) => places.get(id)).filter((p): p is PlannerPlace => Boolean(p)).map((p) => scored(p, ctx));
  const kind = day.kind;
  const baseCapacity = Math.round(budget.activeMinutes * (kind === "full" ? 1 : budget.halfDayShare) * (opts.capacityScale ?? 1));
  const plan: DayPlan = {
    dayIndex: day.index,
    stayId: day.stayId,
    citySlug: day.citySlug,
    isDayTrip,
    isTransfer: day.activities.some((a) => a.kind === "hotel_checkout"),
    dayTripMinutes: 0,
    kind,
    date: day.date,
    clusterIds: day.clusterIds,
    candidates,
    capacity: baseCapacity,
    theme: day.theme,
    indoorShare: candidates.length ? candidates.filter((c) => c.place.indoor).length / candidates.length : 0,
    plannedWalkKm: 0,
  };
  const beaches = ctx.prefs.tripStyle === "relax" ? beachesNear([...ctx.places.values()], center) : undefined;
  const result = scheduleDay(plan, { prefs: ctx.prefs, budget, base: center, pool: [], fixedOrder: true, locked: pinned, travel: ctx.travel, beaches });
  // Keep lock flags.
  result.day.activities = result.day.activities.map((a) => ({ ...a, locked: a.placeId ? locked.has(a.placeId) : false }));
  if (result.leftovers.length) {
    result.day.warnings.push({ code: "day_too_full", severity: "warning", params: { dropped: result.leftovers.length }, dayIndex: day.index });
  }
  return result.day;
}

function replaceDay(it: Itinerary, day: ItineraryDay): Itinerary {
  return { ...it, days: it.days.map((d) => (d.index === day.index ? day : d)) };
}

function visitIds(day: ItineraryDay): string[] {
  return day.activities.filter((a) => a.kind === "visit").map((a) => a.placeId!);
}

/** Up to `n` unused places near the activity, similar duration, open that day. */
export function alternativesFor(it: Itinerary, dayIndex: number, activityId: string, ctx: EditContext, n = 3): PlannerPlace[] {
  const day = it.days[dayIndex];
  const activity = day?.activities.find((a) => a.id === activityId);
  if (!day || !activity?.placeId) return [];
  const places = placeMap(ctx);
  const current = places.get(activity.placeId);
  if (!current) return [];
  const used = usedPlaceIds(it);
  const duration = current.visitMinutes;
  return ctx.places
    .filter(
      (p) =>
        !used.has(p.id) &&
        p.city === day.citySlug &&
        exclusionReason(p, ctx.prefs) === null &&
        haversineKm(current, p) <= 2.5 &&
        p.visitMinutes >= duration * 0.5 &&
        p.visitMinutes <= duration * 1.6 &&
        opensOnDate(p, day.date) !== "closed",
    )
    .map((p) => scored(p, ctx))
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map((s) => s.place);
}

export function swapActivity(it: Itinerary, dayIndex: number, activityId: string, newPlaceId: string, ctx: EditContext): Itinerary {
  const day = it.days[dayIndex];
  const activity = day.activities.find((a) => a.id === activityId);
  if (!activity?.placeId) return it;
  const ids = visitIds(day).map((id) => (id === activity.placeId ? newPlaceId : id));
  return replaceDay(it, rescheduleDay(it, day, ids, ctx));
}

/** Move a visit to another day (appended at `position`, default end). Both days are re-timed. */
export function moveActivity(it: Itinerary, fromDay: number, activityId: string, toDay: number, ctx: EditContext, position?: number): Itinerary {
  const from = it.days[fromDay];
  const to = it.days[toDay];
  const activity = from?.activities.find((a) => a.id === activityId);
  if (!from || !to || !activity?.placeId) return it;
  if (fromDay === toDay) {
    const ids = visitIds(from).filter((id) => id !== activity.placeId);
    ids.splice(position ?? ids.length, 0, activity.placeId);
    return replaceDay(it, rescheduleDay(it, from, ids, ctx));
  }
  const fromIds = visitIds(from).filter((id) => id !== activity.placeId);
  const toIds = visitIds(to);
  toIds.splice(position ?? toIds.length, 0, activity.placeId);
  let out = replaceDay(it, rescheduleDay(it, from, fromIds, ctx));
  out = replaceDay(out, rescheduleDay(out, to, toIds, ctx));
  return out;
}

/** "Too full" drops the weakest unlocked visit; "too light" adds the best nearby unused place. */
export function rebalanceDay(it: Itinerary, dayIndex: number, direction: "lighter" | "heavier", ctx: EditContext): Itinerary {
  const day = it.days[dayIndex];
  if (!day) return it;
  const ids = visitIds(day);
  if (direction === "lighter") {
    const isWished = (id: string | null) => ctx.prefs.mustVisit.some((m) => m.placeId === id);
    const unlocked = day.activities.filter((a) => a.kind === "visit" && !a.locked && a.placeId && !isWished(a.placeId));
    if (unlocked.length === 0) return it;
    const places = placeMap(ctx);
    const worst = unlocked
      .map((a) => ({ a, s: scorePlace(places.get(a.placeId!)!, ctx.prefs) }))
      .sort((x, y) => x.s - y.s)[0].a;
    // Exactly one visit goes: the rest is pinned, so a day built with the relaxed limits does not lose a second one.
    return replaceDay(it, rescheduleDay(it, day, ids.filter((id) => id !== worst.placeId), ctx, { keepAll: true }));
  }
  const used = usedPlaceIds(it);
  const places = placeMap(ctx);
  const last = places.get(ids[ids.length - 1] ?? "");
  const { center } = baseFor(it, day, ctx);
  const anchor = last ?? center;
  // Candidates near the day's last stop or its base, best first; the first one that survives scheduling wins
  // (a place that does not fit the remaining walking budget or closes early would otherwise leave the day unchanged).
  const candidates = ctx.places
    .filter((p) => !used.has(p.id) && p.city === day.citySlug && exclusionReason(p, ctx.prefs) === null && Math.min(haversineKm(anchor, p), haversineKm(center, p)) <= 4 && opensOnDate(p, day.date) !== "closed")
    .map((p) => scored(p, ctx))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
  for (const cand of candidates) {
    const next = rescheduleDay(it, day, [...ids, cand.place.id], ctx, { capacityScale: 1.3, walkScale: 1.35 });
    if (visitIds(next).includes(cand.place.id)) return replaceDay(it, next);
  }
  return it;
}

/** Drop a visit from a day and re-time the rest. */
export function removeActivity(it: Itinerary, dayIndex: number, activityId: string, ctx: EditContext): Itinerary {
  const day = it.days[dayIndex];
  const activity = day?.activities.find((a) => a.id === activityId);
  if (!day || !activity?.placeId) return it;
  return replaceDay(it, rescheduleDay(it, day, visitIds(day).filter((id) => id !== activity.placeId), ctx));
}

/** Re-time a day in an explicit order of place ids (after a drag-and-drop). Unknown ids are ignored. */
export function reorderDay(it: Itinerary, dayIndex: number, placeIds: string[], ctx: EditContext, opts: { keepAll?: boolean } = {}): Itinerary {
  const day = it.days[dayIndex];
  if (!day) return it;
  const current = new Set(visitIds(day));
  const ids = placeIds.filter((id) => current.has(id));
  for (const id of visitIds(day)) if (!ids.includes(id)) ids.push(id);
  return replaceDay(it, rescheduleDay(it, day, ids, ctx, opts));
}

export function toggleLock(it: Itinerary, dayIndex: number, activityId: string): Itinerary {
  const day = it.days[dayIndex];
  if (!day) return it;
  return replaceDay(it, {
    ...day,
    activities: day.activities.map((a) => (a.id === activityId ? { ...a, locked: !a.locked } : a)),
  });
}

/** Re-plan a day around its locked visits: locked ones stay, the rest is refilled from unused places. */
export function rebuildUnlocked(it: Itinerary, dayIndex: number, ctx: EditContext): Itinerary {
  const day = it.days[dayIndex];
  if (!day) return it;
  const lockedIds = day.activities.filter((a) => a.kind === "visit" && (a.locked || ctx.prefs.mustVisit.some((m) => m.placeId === a.placeId))).map((a) => a.placeId!);
  const used = usedPlaceIds(it);
  for (const id of visitIds(day)) used.delete(id);
  const { center } = baseFor(it, day, ctx);
  const fresh = ctx.places
    .filter((p) => !used.has(p.id) && !lockedIds.includes(p.id) && p.city === day.citySlug && exclusionReason(p, ctx.prefs) === null && haversineKm(center, p) <= 4 && opensOnDate(p, day.date) !== "closed")
    .map((p) => scored(p, ctx))
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map((s) => s.place.id);
  return replaceDay(it, rescheduleDay(it, day, [...lockedIds, ...fresh], ctx));
}
