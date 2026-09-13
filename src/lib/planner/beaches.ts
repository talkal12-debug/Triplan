import { haversineKm, type LatLng } from "./geo";
import type { PlannerPlace } from "./itinerary";

/**
 * Beaches for the "relax" trip style. A beach is any place tagged as one; the
 * planner keeps them out of the sightseeing pool and gives each relax day its
 * own beach block instead (rotating when there are several). Client-safe, pure.
 */
export const BEACH_REACH_KM = 45;

export function isBeach(place: Pick<PlannerPlace, "category" | "tags">): boolean {
  return place.category === "beach" || place.tags.includes("beaches");
}

/** Beaches within reach of a base, nearest first. */
export function beachesNear(places: PlannerPlace[], base: LatLng, maxKm = BEACH_REACH_KM): PlannerPlace[] {
  // Real beaches before places merely tagged with them (a seaside town centre), nearest first.
  return places
    .filter((p) => isBeach(p) && haversineKm(p, base) <= maxKm)
    .sort((a, b) => Number(b.category === "beach") - Number(a.category === "beach") || haversineKm(a, base) - haversineKm(b, base));
}

/**
 * Beaches of other cities of the same country that are within reach of a selected
 * city (Lisbon has none of its own; Carcavelos and Guincho sit under Sintra), re-tagged
 * to the nearest selected city so the planner treats them as that city's.
 */
export function borrowBeaches(candidates: PlannerPlace[], selected: { slug: string; center: LatLng }[], maxKm = BEACH_REACH_KM): PlannerPlace[] {
  const out: PlannerPlace[] = [];
  for (const p of candidates) {
    if (!isBeach(p)) continue;
    let best: { slug: string; km: number } | null = null;
    for (const c of selected) {
      const km = haversineKm(p, c.center);
      if (km <= maxKm && (!best || km < best.km)) best = { slug: c.slug, km };
    }
    if (best) out.push({ ...p, city: best.slug });
  }
  return out;
}
