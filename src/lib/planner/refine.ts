import type { LatLng } from "./geo";
import type { Itinerary, PlannerCity, PlannerPlace, TravelMode, Transit } from "./itinerary";
import type { TripPreferences } from "./types";
import { reorderDay } from "./edit";

/** Real travel times for pairs of points, keyed by coordinates and mode. */
export type TravelLookup = (a: LatLng, b: LatLng, mode: TravelMode) => Transit | null;

export type MatrixFetcher = (points: LatLng[], mode: TravelMode) => Promise<{ minutes: (number | null)[][]; meters: (number | null)[][]; estimated: boolean }>;

const key = (p: LatLng) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;

/**
 * Re-time every day of an itinerary with real routing (OSRM) for walking, cycling
 * and driving legs. The visiting order is kept; only durations and distances change.
 * Days whose matrix could not be fetched keep their estimates.
 */
export async function refineTravel(
  it: Itinerary,
  ctx: { prefs: TripPreferences; places: PlannerPlace[]; cities: PlannerCity[] },
  fetchMatrix: MatrixFetcher,
  dayIndexes?: number[],
): Promise<{ itinerary: Itinerary; refinedDays: number[] }> {
  const placeById = new Map(ctx.places.map((p) => [p.id, p]));
  const modes = (["walk", "bike", "car"] as const).filter((m) => ctx.prefs.transport[m] > 0 || m === "walk");
  const table = new Map<string, Transit>();
  const refinedDays: number[] = [];
  let out = it;

  for (const day of it.days) {
    if (dayIndexes && !dayIndexes.includes(day.index)) continue;
    const stay = it.stays.find((s) => s.id === day.stayId);
    const city = ctx.cities.find((c) => c.slug === day.citySlug);
    const base = day.citySlug !== stay?.citySlug && city ? city.center : stay?.center;
    const visits = day.activities.filter((a) => a.kind === "visit" && a.placeId && placeById.has(a.placeId));
    if (!base || visits.length === 0) continue;
    const points: LatLng[] = [base, ...visits.map((a) => placeById.get(a.placeId!)!)];

    let any = false;
    for (const mode of modes) {
      try {
        const m = await fetchMatrix(points, mode);
        if (m.estimated) continue;
        points.forEach((a, i) =>
          points.forEach((b, j) => {
            const minutes = m.minutes[i]?.[j];
            const meters = m.meters[i]?.[j];
            if (minutes !== null && minutes !== undefined && meters !== null && meters !== undefined) {
              table.set(`${key(a)}|${key(b)}|${mode}`, { mode, minutes, meters, estimated: false });
            }
          }),
        );
        any = true;
      } catch {
        // keep estimates for this mode
      }
    }
    if (!any) continue;

    const lookup: TravelLookup = (a, b, mode) => table.get(`${key(a)}|${key(b)}|${mode}`) ?? null;
    out = reorderDay(out, day.index, visits.map((a) => a.placeId!), { ...ctx, travel: lookup });
    refinedDays.push(day.index);
  }

  return { itinerary: out, refinedDays };
}
