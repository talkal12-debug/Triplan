import { centroid, haversineKm, type LatLng } from "./geo";
import type { Itinerary } from "./itinerary";

/**
 * "Where to sleep": the areas from which the plan's days are shortest to reach.
 * Nothing is looked up: candidates are the centre of gravity of each day, of the
 * whole stay, and the base the planner already chose; each is scored by the mean
 * distance to every day's centre of gravity, so a hotel there keeps the whole
 * stay walkable rather than one day. Anchored to the nearest visited place so the
 * traveller has a name to search hotels by. Client-safe, pure.
 */
export type SleepZone = {
  lat: number;
  lng: number;
  /** Nearest visited place: the zone is described as "near X". */
  anchorPlaceId: string;
  /** Mean distance (km) to the centre of each day of the stay. */
  avgKm: number;
  /** Days of the stay whose centre is within walking reach (2 km, about 25 minutes). */
  daysNear: number;
  days: number;
};

const WALK_KM = 2;
const DISTINCT_KM = 0.8;

export function sleepZones(itinerary: Itinerary, places: Record<string, LatLng>, stayId: string, max = 3): SleepZone[] {
  const stay = itinerary.stays.find((s) => s.id === stayId);
  if (!stay) return [];
  const days = itinerary.days.filter((d) => d.stayId === stayId);
  const dayPoints = days
    .map((d) => d.activities.filter((a) => a.kind === "visit" && a.placeId && places[a.placeId]).map((a) => ({ id: a.placeId!, ...places[a.placeId!] })))
    .filter((pts) => pts.length > 0);
  if (dayPoints.length === 0) return [];
  const dayCentres = dayPoints.map((pts) => centroid(pts));
  const visited = dayPoints.flat();
  const candidates: LatLng[] = [...dayCentres, centroid(visited), stay.center];

  const scored = candidates.map((c) => {
    const dists = dayCentres.map((dc) => haversineKm(c, dc));
    const avgKm = dists.reduce((s, x) => s + x, 0) / dists.length;
    // Mean distance, with the worst day weighing extra: a base between two areas beats one that serves only one of them.
    const score = avgKm + 0.5 * Math.max(...dists);
    return { c, avgKm, score, daysNear: dists.filter((x) => x <= WALK_KM).length };
  });
  scored.sort((a, b) => a.score - b.score);

  const zones: SleepZone[] = [];
  for (const s of scored) {
    if (zones.some((z) => haversineKm(z, s.c) < DISTINCT_KM)) continue;
    const anchor = visited.reduce((best, p) => (haversineKm(p, s.c) < haversineKm(best, s.c) ? p : best), visited[0]);
    zones.push({ lat: s.c.lat, lng: s.c.lng, anchorPlaceId: anchor.id, avgKm: Math.round(s.avgKm * 10) / 10, daysNear: s.daysNear, days: dayCentres.length });
    if (zones.length >= max) break;
  }
  return zones;
}
