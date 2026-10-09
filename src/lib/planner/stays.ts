import { estimateMinutes, haversineKm, routeCities } from "./geo";
import type { Cluster } from "./clustering";
import type { PlannerCity, Stay, Warning } from "./itinerary";
import { recommendBaseMode, type TripPreferences } from "./types";
import type { DayBudget } from "./budgets";

/** One calendar day of the trip: where the traveller sleeps and where they spend the day. */
export type DaySlot = {
  dayIndex: number;
  stayId: string;
  /** City whose places fill the day (may differ from the stay's city on a day trip). */
  citySlug: string;
  isDayTrip: boolean;
  /** Morning hotel change: reduced capacity. */
  isTransfer: boolean;
  /** Round-trip travel to a day-trip city, minutes (0 otherwise). */
  dayTripMinutes: number;
};

export type StayPlan = {
  baseMode: "single" | "multi";
  stays: Stay[];
  slots: DaySlot[];
  warnings: Warning[];
};

/** `order`: position in the traveller's own list of cities for that country (Infinity when the planner chose). */
type CityInfo = { city: PlannerCity; value: number; minutes: number; countryIndex: number; order: number };

/**
 * A city's weight when sharing days: the scores of its best places, not all of them.
 * Summing everything rewarded catalogue size (80 lake villages outweighed Milan's 36 curated sights).
 */
const VALUE_TOP_PLACES = 25;
function cityValue(clusters: Cluster[]): number {
  return clusters
    .flatMap((c) => c.members.map((m) => m.score))
    .sort((a, b) => b - a)
    .slice(0, VALUE_TOP_PLACES)
    .reduce((s, v) => s + v, 0);
}

function cityInfos(prefs: TripPreferences, cities: PlannerCity[], clustersByCity: Map<string, Cluster[]>): CityInfo[] {
  const out: CityInfo[] = [];
  prefs.destinations.forEach((dest, countryIndex) => {
    const inCountry = cities.filter((c) => c.countryCode === dest.countryCode);
    const chosen = dest.cities.length ? inCountry.filter((c) => dest.cities.includes(c.slug)) : inCountry;
    for (const city of chosen) {
      const clusters = clustersByCity.get(city.slug) ?? [];
      const at = dest.cities.indexOf(city.slug);
      out.push({
        city,
        countryIndex,
        value: cityValue(clusters),
        minutes: clusters.reduce((s, c) => s + c.visitMinutes, 0),
        order: at >= 0 ? at : Infinity,
      });
    }
  });
  return out;
}

/** Split `total` days across items proportionally to value, each getting at least `min`. */
function allocate(values: number[], total: number, min: number): number[] {
  const n = values.length;
  const base = new Array(n).fill(min);
  let left = total - min * n;
  if (left <= 0) return base;
  const sum = values.reduce((a, b) => a + b, 0) || 1;
  const exact = values.map((v) => (v / sum) * left);
  const floors = exact.map(Math.floor);
  left -= floors.reduce((a, b) => a + b, 0);
  const remainders = exact.map((e, i) => ({ i, r: e - floors[i] })).sort((a, b) => b.r - a.r);
  for (let k = 0; k < left; k++) floors[remainders[k % n].i] += 1;
  return base.map((b, i) => b + floors[i]);
}

function transferMinutes(a: PlannerCity, b: PlannerCity, prefs: TripPreferences): number {
  const km = haversineKm(a.center, b.center);
  const mode = prefs.transport.car > 0 ? "car" : "transit";
  return estimateMinutes(km, mode);
}

export function planStays(
  prefs: TripPreferences,
  cities: PlannerCity[],
  clustersByCity: Map<string, Cluster[]>,
  budget: DayBudget,
): StayPlan {
  const days = prefs.dates.days;
  const warnings: Warning[] = [];
  const infos = cityInfos(prefs, cities, clustersByCity).filter((i) => i.value > 0);
  if (infos.length === 0) {
    warnings.push({ code: "no_places", severity: "error", params: {} });
    return { baseMode: "single", stays: [], slots: [], warnings };
  }

  // "Not sure": recommend on the cities that will actually be visited, not only the ones ticked.
  const effective = {
    ...prefs,
    destinations: prefs.destinations.map((d, i) => ({
      ...d,
      cities: infos.filter((info) => info.countryIndex === i).map((info) => info.city.slug),
    })),
  };
  const mode = prefs.hotel.baseMode === "auto" ? recommendBaseMode(effective).mode : prefs.hotel.baseMode;
  const stays: Stay[] = [];
  const slots: DaySlot[] = [];

  // Group cities per country, in the order the traveller listed the countries.
  const byCountry = new Map<number, CityInfo[]>();
  for (const info of infos) byCountry.set(info.countryIndex, [...(byCountry.get(info.countryIndex) ?? []), info]);
  const countryGroups = [...byCountry.entries()].sort((a, b) => a[0] - b[0]).map(([, g]) => g);

  // Days per country, proportional to value.
  const countryDays = allocate(
    countryGroups.map((g) => g.reduce((s, i) => s + i.value, 0)),
    days,
    1,
  );

  // The base is the city the traveller listed first (a Milan trip with a Lake Como add-on sleeps in Milan);
  // when the planner picked the cities, the most valuable one.
  const baseOf = (group: CityInfo[]) =>
    group.reduce((best, info) => (info.order < best.order || (info.order === best.order && info.value > best.value) ? info : best), group[0]);

  let dayCursor = 0;
  countryGroups.forEach((group, gi) => {
    const groupDays = countryDays[gi];
    // "Not sure" about hotels and a chosen city too far for a day trip: give it its own stay rather than drop it.
    let groupMode = mode;
    if (groupMode === "single" && prefs.hotel.baseMode === "auto" && group.length > 1 && groupDays >= group.length) {
      const base = baseOf(group);
      if (group.some((info) => info !== base && transferMinutes(base.city, info.city, prefs) * 2 > budget.maxBaseRoundTripMinutes)) groupMode = "multi";
    }
    if (groupMode === "multi" && group.length > 1) {
      // Moving route: one stay per city, routed by nearest neighbour from the base city.
      const startIndex = group.indexOf(baseOf(group));
      const routed = routeCities(group.map((i) => ({ ...i, center: i.city.center })), startIndex);
      // Never more stays than days; drop the least valuable extra cities.
      const kept = routed.length > groupDays ? [...routed].sort((a, b) => b.value - a.value).slice(0, groupDays) : routed;
      const keptRouted = routed.filter((r) => kept.includes(r));
      for (const dropped of routed.filter((r) => !kept.includes(r))) {
        warnings.push({ code: "city_dropped", severity: "warning", params: { city: dropped.city.slug } });
      }
      const perCity = allocate(keptRouted.map((i) => i.value), groupDays, 1);
      // The city the traveller listed first is the heart of the trip: never fewer days than an add-on.
      const primaryInfo = baseOf(keptRouted);
      const primary = keptRouted.findIndex((r) => r.city.slug === primaryInfo.city.slug);
      const most = perCity.reduce((m, d, i) => (d > perCity[m] ? i : m), 0);
      if (primary >= 0 && primaryInfo.order !== Infinity && perCity[primary] < perCity[most]) {
        [perCity[primary], perCity[most]] = [perCity[most], perCity[primary]];
      }
      keptRouted.forEach((info, ci) => {
        const stayId = `stay-${stays.length + 1}`;
        const from = dayCursor;
        const to = dayCursor + perCity[ci] - 1;
        stays.push({
          id: stayId,
          citySlug: info.city.slug,
          countryCode: info.city.countryCode,
          fromDay: from,
          toDay: to,
          center: info.city.center,
          locationPref: prefs.hotel.locationPref,
        });
        for (let d = from; d <= to; d++) {
          slots.push({
            dayIndex: d,
            stayId,
            citySlug: info.city.slug,
            isDayTrip: false,
            isTransfer: d === from && stays.length > 1,
            dayTripMinutes: 0,
          });
        }
        dayCursor = to + 1;
      });
      return;
    }

    // Single base per country: the first city the traveller chose; others become day trips when close enough.
    const base = baseOf(group);
    const stayId = `stay-${stays.length + 1}`;
    const from = dayCursor;
    const to = dayCursor + groupDays - 1;
    stays.push({
      id: stayId,
      citySlug: base.city.slug,
      countryCode: base.city.countryCode,
      fromDay: from,
      toDay: to,
      center: base.city.center,
      locationPref: prefs.hotel.locationPref,
    });

    const dayTrips: { info: CityInfo; minutes: number }[] = [];
    for (const info of group) {
      if (info === base) continue;
      const oneWay = transferMinutes(base.city, info.city, prefs);
      if (oneWay * 2 <= budget.maxBaseRoundTripMinutes) dayTrips.push({ info, minutes: oneWay * 2 });
      else {
        warnings.push({
          code: "base_too_far",
          severity: "warning",
          params: { city: info.city.slug, base: base.city.slug, minutes: oneWay * 2 },
        });
      }
    }
    dayTrips.sort((a, b) => b.info.value - a.info.value);
    // Base city keeps at least half the days (and the arrival / departure days).
    const maxTrips = Math.max(0, Math.min(dayTrips.length, Math.floor(groupDays / 2), groupDays - 2));
    const tripDays = dayTrips.slice(0, maxTrips);
    for (const dropped of dayTrips.slice(maxTrips)) {
      warnings.push({ code: "city_dropped", severity: "info", params: { city: dropped.info.city.slug } });
    }

    // Spread day trips over the middle of the stay (never first or last day).
    const middle: number[] = [];
    for (let d = from + 1; d < to; d++) middle.push(d);
    const tripDayIndexes = tripDays.map((_, k) => middle[Math.round(((k + 1) * middle.length) / (tripDays.length + 1)) - 1] ?? middle[k]);

    for (let d = from; d <= to; d++) {
      const tripK = tripDayIndexes.indexOf(d);
      const trip = tripK >= 0 ? tripDays[tripK] : null;
      slots.push({
        dayIndex: d,
        stayId,
        citySlug: trip ? trip.info.city.slug : base.city.slug,
        isDayTrip: Boolean(trip),
        isTransfer: d === from && stays.length > 1,
        dayTripMinutes: trip ? trip.minutes : 0,
      });
    }
    dayCursor = to + 1;
  });

  return { baseMode: stays.length > countryGroups.length ? "multi" : mode, stays, slots, warnings };
}
