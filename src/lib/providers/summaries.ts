import "server-only";
import { prisma } from "@/lib/db";
import type { PlaceSeed } from "@/lib/data/schemas";
import { fetchSummariesBatch } from "./summaries-core";

export { fetchSummaries, trimExtract, type Summary } from "./summaries-core";

/**
 * Fill in missing summaries (in `locales`) for the places a plan uses and
 * remember them in the Place table when the place is stored there.
 * Never throws: a place without a source simply stays without a summary.
 */
export async function withSummaries(places: PlaceSeed[], locales: string[]): Promise<PlaceSeed[]> {
  const items = places
    .filter((p) => p.wikidata && locales.some((l) => !p.summary?.[l]))
    .map((p) => ({ id: p.id, wikidata: p.wikidata!, locales: locales.filter((l) => !p.summary?.[l]) }));
  if (items.length === 0) return places;
  let results: Awaited<ReturnType<typeof fetchSummariesBatch>>;
  try {
    results = await fetchSummariesBatch(items);
  } catch {
    return places;
  }
  if (results.size === 0) return places;
  const out = places.map((p) => (results.has(p.id) ? { ...p, summary: { ...(p.summary ?? {}), ...results.get(p.id)! } } : p));
  // Persist for next time (fire and forget; seed places have no row until something caches them).
  void Promise.all(
    out
      .filter((p) => results.has(p.id))
      .map((p) => prisma.place.updateMany({ where: { id: p.id }, data: { summary: JSON.stringify(p.summary) } }).catch(() => undefined)),
  );
  return out;
}
