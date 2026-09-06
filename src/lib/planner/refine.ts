import type { LatLng } from "./geo";
import type { Itinerary, PlannerCity, PlannerPlace, TravelMode, Transit } from "./itinerary";
import type { TripPreferences } from "./types";
import { reorderDay } from "./edit";

/** Real travel times for pairs of points, keyed by coordinates and mode. */
export type TravelLookup = (a: LatLng, b: LatLng, mode: TravelMode) => Transit | null;

export type MatrixFetcher = (points: LatLng[], mode: TravelMode) => Promise<{ minutes: (number | null)[][]; meters: (number | null)[][]; estimated: boolean }>;

const key = (p: LatLng) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;
const CONCURRENCY = 4;

/**
 * Re-time every day of an itinerary with real routing (OSRM) for walking, cycling
 * and driving legs. The visiting order is kept; only durations and distances change.
 * Matrices are fetched concurrently (a few at a time); days whose matrix could not be
 * fetched keep their estimates.
 */
export async function refineTravel(
  it: Itinerary,
  ctx: { prefs: TripPreferences; places: PlannerPlace[]; cities: PlannerCity[] },
  fetchMatrix: MatrixFetcher,
  dayIndexes?: number[],
): Promise<{ itinerary: Itinerary; refinedDays: number[] }> {
  const placeById = new Map(ctx.places.map((p) => [p.id, p]));
  const modes = (["walk", "bike", "car"] as const).filter((m) => ctx.prefs.transport[m] > 0 || m === "walk");

  // 1. Which days need which point sets.
  const jobs: { dayIndex: number; points: LatLng[]; visitIds: string[] }[] = [];
  for (const day of it.days) {
    if (dayIndexes && !dayIndexes.includes(day.index)) continue;
    const stay = it.stays.find((s) => s.id === day.stayId);
    const city = ctx.cities.find((c) => c.slug === day.citySlug);
    const base = day.citySlug !== stay?.citySlug && city ? city.center : stay?.center;
    const visits = day.activities.filter((a) => a.kind === "visit" && a.placeId && placeById.has(a.placeId));
    if (!base || visits.length === 0) continue;
    jobs.push({ dayIndex: day.index, points: [base, ...visits.map((a) => placeById.get(a.placeId!)!)], visitIds: visits.map((a) => a.placeId!) });
  }

  // 2. Fetch all matrices with limited concurrency.
  const tasks = jobs.flatMap((job) => modes.map((mode) => ({ job, mode })));
  const table = new Map<string, Transit>();
  const fetched = new Set<number>();
  let cursor = 0;
  const worker = async () => {
    while (cursor < tasks.length) {
      const { job, mode } = tasks[cursor++];
      try {
        const m = await fetchMatrix(job.points, mode);
        if (m.estimated) continue;
        job.points.forEach((a, i) =>
          job.points.forEach((b, j) => {
            const minutes = m.minutes[i]?.[j];
            const meters = m.meters[i]?.[j];
            if (minutes !== null && minutes !== undefined && meters !== null && meters !== undefined) {
              table.set(`${key(a)}|${key(b)}|${mode}`, { mode, minutes, meters, estimated: false });
            }
          }),
        );
        fetched.add(job.dayIndex);
      } catch {
        // keep estimates for this day/mode
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, tasks.length) }, worker));

  // 3. Re-time the days that got real numbers, in order (deterministic).
  const lookup: TravelLookup = (a, b, mode) => table.get(`${key(a)}|${key(b)}|${mode}`) ?? null;
  let out = it;
  const refinedDays: number[] = [];
  for (const job of jobs) {
    if (!fetched.has(job.dayIndex)) continue;
    // Real travel times re-time the day; they never take a visit away (an edit the traveller just made would vanish).
    out = reorderDay(out, job.dayIndex, job.visitIds, { ...ctx, travel: lookup }, { keepAll: true });
    refinedDays.push(job.dayIndex);
  }
  return { itinerary: out, refinedDays };
}
