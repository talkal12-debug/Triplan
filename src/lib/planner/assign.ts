import { clustersAdjacent, type Cluster } from "./clustering";
import { haversineKm, tourOrder } from "./geo";
import type { DayBudget } from "./budgets";
import type { DayKind, DayWeather } from "./itinerary";
import type { ScoredPlace } from "./scoring";
import type { DaySlot } from "./stays";
import type { TripPreferences } from "./types";

/** A day with its candidate places chosen, before times are assigned. */
export type DayPlan = DaySlot & {
  kind: DayKind;
  date: string;
  clusterIds: string[];
  candidates: ScoredPlace[];
  /** Active minutes available today. */
  capacity: number;
  theme: string | null;
  indoorShare: number;
  /** Estimated walking for the candidates, km (before timing). */
  plannedWalkKm: number;
};

/** Rough per-place overhead for walking inside a cluster, minutes. */
const INTRA_CLUSTER_MIN = 12;
const ADJACENT_KM = 2.5;

export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function dayKind(index: number, total: number): DayKind {
  if (total === 1) return "arrival_departure";
  if (index === 0) return "arrival";
  if (index === total - 1) return "departure";
  return "full";
}

export function dayCapacity(slot: DaySlot, kind: DayKind, budget: DayBudget): number {
  let cap = budget.activeMinutes;
  if (kind !== "full") cap *= budget.halfDayShare;
  if (slot.isTransfer) cap *= 0.75;
  cap -= slot.dayTripMinutes; // travel eats the day
  return Math.max(0, Math.round(cap));
}

/** Category -> coarse theme, used for variety between days and as the day's headline. */
const themeOfCategory: Record<string, string> = {
  museum: "museums",
  gallery: "museums",
  park: "nature",
  garden: "nature",
  nature: "nature",
  beach: "beaches",
  day_trip: "nature",
  church: "history",
  shrine: "history",
  temple: "history",
  castle: "history",
  palace: "history",
  monument: "history",
  landmark: "history",
  market: "food",
  food: "food",
  neighborhood: "city",
  square: "city",
  shopping: "shopping",
  viewpoint: "city",
  waterfront: "city",
  tower: "city",
  bridge: "city",
  theme_park: "kids",
  zoo: "kids",
  aquarium: "kids",
  nightlife: "nightlife",
};

export function dominantTheme(candidates: ScoredPlace[], _prefs?: TripPreferences): string | null {
  void _prefs;
  const minutes = new Map<string, number>();
  for (const c of candidates) {
    const theme = themeOfCategory[c.place.category] ?? "city";
    minutes.set(theme, (minutes.get(theme) ?? 0) + c.place.visitMinutes);
  }
  let best: string | null = null;
  let bestN = 0;
  for (const [theme, n] of minutes) if (n > bestN) [best, bestN] = [theme, n];
  return best;
}

/** Rough walking distance for a set of places in a sensible order, km. */
export function plannedWalkKm(candidates: ScoredPlace[], start: { lat: number; lng: number }): number {
  if (candidates.length === 0) return 0;
  const order = tourOrder(start, candidates.map((c) => c.place));
  let km = 0;
  let here = start;
  for (const i of order) {
    const next = candidates[i].place;
    km += Math.min(haversineKm(here, next) * 1.3, 1.5); // beyond ~1.5 km the traveller rides
    here = next;
  }
  return Math.round(km * 10) / 10;
}

/**
 * Give every day one or two adjacent clusters and pick the places that fit its capacity.
 * Clusters are consumed in value order per city; leftovers stay in the pool for later days.
 */
export function assignClusters(
  slots: DaySlot[],
  clustersByCity: Map<string, Cluster[]>,
  budget: DayBudget,
  prefs: TripPreferences,
): { days: DayPlan[]; pool: Map<string, ScoredPlace[]> } {
  const total = slots.length;
  const remaining = new Map<string, Cluster[]>();
  for (const [city, clusters] of clustersByCity) {
    remaining.set(city, clusters.map((c) => ({ ...c, members: [...c.members] })));
  }
  const days: DayPlan[] = [];
  const mustIds = new Set(prefs.mustVisit.map((m) => m.placeId).filter((id): id is string => Boolean(id)));
  const holdsMust = (c: Cluster) => c.members.some((m) => mustIds.has(m.place.id));

  // Small destination, long stay: spread what there is over the days instead of
  // filling the first ones and leaving the rest empty.
  const scaleByCity = new Map<string, { scale: number; floor: number }>();
  for (const [city, clusters] of remaining) {
    const members = clusters.flatMap((c) => c.members);
    const available = members.reduce((m, p) => m + p.place.visitMinutes + INTRA_CLUSTER_MIN, 0);
    const totalCapacity = slots
      .filter((s) => s.citySlug === city)
      .reduce((s, slot) => s + dayCapacity(slot, dayKind(slot.dayIndex, total), budget), 0);
    const scale = totalCapacity > 0 && available < totalCapacity ? Math.min(1, (available / totalCapacity) * 1.25) : 1;
    // A day must at least be able to hold the longest single visit.
    const floor = Math.max(60, ...members.map((p) => p.place.visitMinutes + INTRA_CLUSTER_MIN));
    scaleByCity.set(city, { scale, floor });
  }

  for (const slot of slots) {
    const kind = dayKind(slot.dayIndex, total);
    const raw = dayCapacity(slot, kind, budget);
    const { scale, floor } = scaleByCity.get(slot.citySlug) ?? { scale: 1, floor: 60 };
    const capacity = scale < 1 ? Math.max(Math.min(floor, raw), Math.round(raw * scale)) : raw;
    const cityClusters = remaining.get(slot.citySlug) ?? [];
    const candidates: ScoredPlace[] = [];
    const clusterIds: string[] = [];
    let used = 0;
    let museums = 0;

    const take = (cluster: Cluster) => {
      const keep: ScoredPlace[] = [];
      for (const m of cluster.members) {
        const cost = m.place.visitMinutes + INTRA_CLUSTER_MIN;
        const isMuseum = m.place.category === "museum" || m.place.category === "gallery";
        if (used + cost <= capacity && (!isMuseum || museums < budget.maxMuseums)) {
          candidates.push(m);
          used += cost;
          if (isMuseum) museums += 1;
        } else {
          keep.push(m);
        }
      }
      cluster.members = keep;
      cluster.value = keep.reduce((s, m) => s + m.score, 0);
      cluster.visitMinutes = keep.reduce((s, m) => s + m.place.visitMinutes, 0);
    };

    // Wishlist first: a cluster with a must-see place takes a full day before the value ranking
    // (on arrival / departure days the usual ranking applies, unless nothing else is left).
    const mustFirst = kind === "full" || slot.dayIndex === total - 1;
    cityClusters.sort((a, b) => (mustFirst ? Number(holdsMust(b)) - Number(holdsMust(a)) : 0) || b.value - a.value || a.id.localeCompare(b.id));
    const first = cityClusters.find((c) => c.members.length > 0);
    if (first) {
      clusterIds.push(first.id);
      take(first);
      // Room for a neighbour?
      if (capacity - used >= 75) {
        const neighbour = cityClusters.find(
          (c) => c !== first && c.members.length > 0 && clustersAdjacent(first, c, ADJACENT_KM),
        );
        if (neighbour) {
          clusterIds.push(neighbour.id);
          take(neighbour);
        }
      }
    }

    days.push({
      ...slot,
      kind,
      date: addDays(prefs.dates.start, slot.dayIndex),
      clusterIds,
      candidates,
      capacity,
      theme: dominantTheme(candidates, prefs),
      indoorShare: candidates.length ? candidates.filter((c) => c.place.indoor).length / candidates.length : 0,
      plannedWalkKm: plannedWalkKm(candidates, first?.center ?? { lat: 0, lng: 0 }),
    });
  }

  const pool = new Map<string, ScoredPlace[]>();
  for (const [city, clusters] of remaining) {
    pool.set(
      city,
      clusters.flatMap((c) => c.members).sort((a, b) => b.score - a.score),
    );
  }
  return { days, pool };
}

/**
 * Rain falls where it falls: move indoor-heavy days onto wet dates (within a stay, full days only).
 */
export function alignWithWeather(days: DayPlan[], weather: Record<string, DayWeather> | undefined): DayPlan[] {
  if (!weather) return days;
  const out = days.map((d) => ({ ...d }));
  const swappable = (d: DayPlan) => d.kind === "full" && !d.isDayTrip && !d.isTransfer;
  for (let i = 0; i < out.length; i++) {
    const wet = (weather[out[i].date]?.precipProbability ?? 0) >= 60;
    if (!wet || !swappable(out[i])) continue;
    // Find the most indoor day in the same stay that is on a dry date.
    let bestJ = -1;
    let bestShare = out[i].indoorShare;
    for (let j = 0; j < out.length; j++) {
      if (j === i || out[j].stayId !== out[i].stayId || !swappable(out[j])) continue;
      const dryJ = (weather[out[j].date]?.precipProbability ?? 0) < 60;
      if (dryJ && out[j].indoorShare > bestShare) {
        bestShare = out[j].indoorShare;
        bestJ = j;
      }
    }
    if (bestJ >= 0) swapDayContent(out, i, bestJ);
  }
  return out;
}

/** Swap what happens on two days, keeping each day's index/date/stay. */
export function swapDayContent(days: DayPlan[], i: number, j: number) {
  const keys = ["citySlug", "isDayTrip", "dayTripMinutes", "clusterIds", "candidates", "theme", "indoorShare", "capacity", "plannedWalkKm"] as const;
  for (const k of keys) {
    const tmp = days[i][k];
    (days[i] as Record<string, unknown>)[k] = days[j][k];
    (days[j] as Record<string, unknown>)[k] = tmp;
  }
}
