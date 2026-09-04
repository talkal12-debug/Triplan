import type { DayBudget } from "./budgets";
import { hasChildren } from "./budgets";
import { estimateTravel, haversineKm, tourOrder, walkedKm, type LatLng } from "./geo";
import type { Activity, DayStats, ItineraryDay, PlannerPlace, Reason, Transit, Warning } from "./itinerary";
import { earliestOpenStart, opensOnDate } from "./opening";
import type { DayPlan } from "./assign";
import type { ScoredPlace } from "./scoring";
import type { TripPreferences } from "./types";

export type ScheduleContext = {
  prefs: TripPreferences;
  budget: DayBudget;
  /** Where the day starts and ends. */
  base: LatLng;
  /** Extra places of the same city to substitute closed ones or fill a light day. */
  pool: ScoredPlace[];
  /** Keep the given candidate order (user-arranged) instead of routing. */
  fixedOrder?: boolean;
  /** Place ids that must stay in the plan (and keep their order). */
  locked?: Set<string>;
  /** Real routing (milestone 6). Returns null when a pair/mode is unknown -> estimate. */
  travel?: (a: LatLng, b: LatLng, mode: Transit["mode"]) => Transit | null;
};

/** Best transit between two points: real numbers when the lookup has them, else the estimate. */
export function travelBetween(a: LatLng, b: LatLng, prefs: TripPreferences, lookup?: ScheduleContext["travel"]): Transit {
  const est = estimateTravel(a, b, prefs);
  if (!lookup) return est;
  const real = lookup(a, b, est.mode);
  if (real) return real;
  // The estimate picked a mode we cannot route (transit): try walking if it is short.
  if (est.mode === "transit") {
    const walk = lookup(a, b, "walk");
    if (walk && walk.meters <= 1800 && prefs.transport.walk > 0) return walk;
  }
  return est;
}

const weekdayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function weekdayOf(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return weekdayNames[d.getUTCDay()];
}

function reasonsFor(
  place: PlannerPlace,
  transit: Transit | null,
  isFirst: boolean,
  day: DayPlan,
  prefs: TripPreferences,
): Reason[] {
  const reasons: Reason[] = [];
  if (transit) {
    if (isFirst && transit.minutes <= 25) reasons.push({ code: "near_base", params: { minutes: transit.minutes, mode: transit.mode } });
    else if (!isFirst) reasons.push({ code: "near_previous", params: { minutes: transit.minutes, mode: transit.mode } });
  }
  const matched = prefs.interests.find((i) => place.tags.includes(i));
  if (matched) reasons.push({ code: "interest_match", params: { interest: matched } });
  if (prefs.visitNumber === 1 && place.iconicity >= 0.85) reasons.push({ code: "iconic_first_visit", params: {} });
  if (prefs.visitNumber === 3 && (place.tags.includes("hidden") || place.tags.includes("local"))) {
    reasons.push({ code: "hidden_gem_returning", params: {} });
  }
  if (hasChildren(prefs) && place.kidFriendly) reasons.push({ code: "kid_friendly", params: {} });
  if (place.openingHours) reasons.push({ code: "open_on_day", params: { weekday: weekdayOf(day.date) } });
  else reasons.push({ code: "unverified_hours", params: {} });
  if (place.requiresAdvanceBooking) reasons.push({ code: "advance_booking", params: {} });
  if (day.isDayTrip) reasons.push({ code: "day_trip", params: { city: day.citySlug } });
  if (day.kind === "arrival") reasons.push({ code: "half_day_arrival", params: {} });
  if (day.kind === "departure") reasons.push({ code: "half_day_departure", params: {} });
  return reasons;
}

/** Physical intensity: mostly about walking; a full but short-walk day is "moderate". */
export function intensityOf(walkKm: number, walkKmMax: number, load: number, dayTrip: boolean): DayStats["intensity"] {
  const walkShare = walkKmMax > 0 ? walkKm / walkKmMax : 0;
  if (dayTrip || walkShare >= 0.7) return "heavy";
  if (walkShare >= 0.35 || load >= 0.8) return "moderate";
  return "light";
}

function isMuseum(place: PlannerPlace): boolean {
  return place.category === "museum" || place.category === "gallery";
}

/**
 * Turn a day's candidate places into a timed sequence that respects opening hours,
 * the walking budget, meals and rests. Places that do not fit are returned as leftovers.
 */
export function scheduleDay(day: DayPlan, ctx: ScheduleContext): { day: ItineraryDay; leftovers: ScoredPlace[] } {
  const { prefs, budget } = ctx;
  const warnings: Warning[] = [];
  const activities: Activity[] = [];
  const leftovers: ScoredPlace[] = [];
  let seq = 0;
  const nextId = () => `${day.dayIndex}-${++seq}`;

  // Day window.
  let t = budget.dayStart;
  let dayEnd = budget.dayEnd;
  if ((day.kind === "arrival" || day.kind === "arrival_departure") && prefs.dates.arrivalTime) {
    const [h, m] = prefs.dates.arrivalTime.split(":").map(Number);
    t = Math.max(t, h * 60 + m + 120);
  }
  if ((day.kind === "departure" || day.kind === "arrival_departure") && prefs.dates.departureTime) {
    const [h, m] = prefs.dates.departureTime.split(":").map(Number);
    dayEnd = Math.min(dayEnd, h * 60 + m - 180);
  }
  if (day.isTransfer) {
    activities.push({
      id: nextId(),
      kind: "hotel_checkout",
      placeId: null,
      startMin: t,
      endMin: t + 45,
      locked: false,
      reasons: [{ code: "hotel_transfer", params: {} }],
      transitFromPrev: null,
      dataQuality: null,
    });
    t += 45;
  }
  if (day.isDayTrip) {
    t += Math.round(day.dayTripMinutes / 2);
    dayEnd -= Math.round(day.dayTripMinutes / 2);
  }
  if (day.kind === "arrival" || day.kind === "arrival_departure") {
    activities.push({
      id: nextId(),
      kind: "hotel_checkin",
      placeId: null,
      startMin: t,
      endMin: t + 30,
      locked: false,
      reasons: [{ code: "half_day_arrival", params: {} }],
      transitFromPrev: null,
      dataQuality: null,
    });
    t += 30;
  }

  // Order of visits.
  const candidates = [...day.candidates];
  let ordered: ScoredPlace[];
  if (ctx.fixedOrder) {
    ordered = candidates;
  } else {
    const order = tourOrder(ctx.base, candidates.map((c) => c.place));
    ordered = order.map((i) => candidates[i]);
  }

  let here: LatLng = ctx.base;
  let walkKm = 0;
  let activeMinutes = 0;
  let transitMinutes = 0;
  let museums = 0;
  let hadLunch = false;
  let sinceRest = 0;
  const capacity = day.capacity;
  const deferred: ScoredPlace[] = [];

  const placeVisit = (cand: ScoredPlace, allowDefer: boolean): boolean => {
    const place = cand.place;
    const transit = travelBetween(here, place, prefs, ctx.travel);
    const arrive = t + transit.minutes;
    const walkAfter = walkKm + walkedKm(transit);
    const locked = ctx.locked?.has(place.id) ?? false;

    if (!locked) {
      if (walkAfter > budget.walkKmMax) return false;
      if (activeMinutes + transit.minutes + place.visitMinutes > capacity) return false;
      if (isMuseum(place) && museums >= budget.maxMuseums) return false;
    }

    // Lunch before this visit if the window has opened.
    let start = arrive;
    const lunchDue = !hadLunch && arrive >= budget.lunchStart && arrive <= budget.lunchEnd + 30;
    const lunchForced = !hadLunch && arrive + place.visitMinutes > budget.lunchEnd && arrive >= budget.lunchStart - 30;
    let lunchAt: number | null = null;
    if (lunchDue || lunchForced) {
      lunchAt = Math.max(arrive, budget.lunchStart);
      start = lunchAt + budget.lunchMinutes;
    }
    // Rest for kids / seniors.
    let restAt: number | null = null;
    if (budget.restEveryMinutes > 0 && sinceRest + transit.minutes + place.visitMinutes > budget.restEveryMinutes && sinceRest > 45) {
      restAt = start;
      start += budget.restMinutes;
    }

    // Bars and night markets only make sense in the evening.
    if (place.category === "nightlife") start = Math.max(start, 17 * 60);

    const latestStart = dayEnd - place.visitMinutes;
    if (start > latestStart && !locked) return false;
    const openStart = earliestOpenStart(place, day.date, start, place.visitMinutes, latestStart);
    if (openStart === null) {
      if (!locked) {
        warnings.push({ code: "closed_on_date", severity: "warning", params: { place: place.id }, dayIndex: day.dayIndex, placeId: place.id });
      }
      return false;
    }
    if (openStart > start + 75 && allowDefer && !locked) {
      deferred.push(cand);
      return true; // handled later
    }
    start = openStart;

    if (lunchAt !== null) {
      activities.push({ id: nextId(), kind: "meal", placeId: null, startMin: lunchAt, endMin: lunchAt + budget.lunchMinutes, locked: false, reasons: [{ code: "lunch_time", params: {} }], transitFromPrev: null, dataQuality: null });
      hadLunch = true;
      sinceRest = 0;
    }
    if (restAt !== null) {
      activities.push({ id: nextId(), kind: "rest", placeId: null, startMin: restAt, endMin: restAt + budget.restMinutes, locked: false, reasons: [{ code: "rest_break", params: {} }], transitFromPrev: null, dataQuality: null });
      sinceRest = 0;
    }

    const isFirstVisit = !activities.some((a) => a.kind === "visit");
    activities.push({
      id: nextId(),
      kind: "visit",
      placeId: place.id,
      startMin: start,
      endMin: start + place.visitMinutes,
      locked,
      reasons: reasonsFor(place, transit, isFirstVisit, day, prefs),
      transitFromPrev: transit,
      dataQuality: place.dataQuality,
    });
    if (place.dataQuality === "unverified") {
      warnings.push({ code: "unverified_data", severity: "info", params: { place: place.id }, dayIndex: day.dayIndex, placeId: place.id });
    }
    if (place.requiresAdvanceBooking) {
      warnings.push({ code: "advance_booking_needed", severity: "info", params: { place: place.id }, dayIndex: day.dayIndex, placeId: place.id });
    }
    here = place;
    t = start + place.visitMinutes;
    walkKm = walkAfter;
    activeMinutes += transit.minutes + place.visitMinutes;
    transitMinutes += transit.minutes;
    sinceRest += transit.minutes + place.visitMinutes;
    if (isMuseum(place)) museums += 1;
    return true;
  };

  for (const cand of ordered) {
    if (!placeVisit(cand, true)) leftovers.push(cand);
  }
  for (const cand of deferred) {
    if (!placeVisit(cand, false)) leftovers.push(cand);
  }

  // Light day? Top up from the pool with places near the current position.
  if (activeMinutes < capacity * 0.55 && !ctx.fixedOrder) {
    const used = new Set(activities.map((a) => a.placeId));
    const nearby = ctx.pool
      .filter((c) => !used.has(c.place.id) && haversineKm(here, c.place) <= 2.5 && opensOnDate(c.place, day.date) !== "closed")
      .sort((a, b) => b.score - a.score);
    for (const cand of nearby) {
      if (activeMinutes >= capacity * 0.8) break;
      if (placeVisit(cand, false)) {
        const idx = ctx.pool.indexOf(cand);
        if (idx >= 0) ctx.pool.splice(idx, 1);
      }
    }
  }

  activities.sort((a, b) => a.startMin - b.startMin);
  const visits = activities.filter((a) => a.kind === "visit").length;
  if (visits === 0 && capacity > 0) {
    warnings.push({ code: "day_too_light", severity: "warning", params: {}, dayIndex: day.dayIndex });
  }

  // Rain plan: indoor places from today's clusters or the pool that are not scheduled.
  const scheduled = new Set(activities.map((a) => a.placeId));
  const rainPlan = [...leftovers, ...ctx.pool]
    .filter((c) => c.place.indoor && !scheduled.has(c.place.id) && haversineKm(ctx.base, c.place) <= 6)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((c) => c.place.id);

  const outdoor = activities.filter((a) => a.kind === "visit").map((a) => day.candidates.concat(ctx.pool).find((c) => c.place.id === a.placeId)?.place.indoor === false);
  const stats: DayStats = {
    walkKm: Math.round(walkKm * 10) / 10,
    activeMinutes,
    transitMinutes,
    load: capacity ? Math.round((activeMinutes / capacity) * 100) / 100 : 0,
    intensity: intensityOf(walkKm, budget.walkKmMax, capacity ? activeMinutes / capacity : 0, day.isDayTrip),
    museums,
    outdoorShare: outdoor.length ? outdoor.filter(Boolean).length / outdoor.length : 0,
    elevationM: null,
  };

  return {
    day: {
      index: day.dayIndex,
      date: day.date,
      kind: day.kind,
      stayId: day.stayId,
      citySlug: day.citySlug,
      clusterIds: day.clusterIds,
      theme: day.theme,
      activities,
      rainPlan,
      stats,
      warnings,
    },
    leftovers,
  };
}
