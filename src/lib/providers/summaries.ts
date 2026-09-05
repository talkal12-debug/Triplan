import "server-only";
import { prisma } from "@/lib/db";
import type { PlaceSeed } from "@/lib/data/schemas";
import { fetchSummariesBatch, type Summary } from "./summaries-core";
import { translateTexts } from "./translate";

export { fetchSummaries, trimExtract, type Summary } from "./summaries-core";

/**
 * For places that have an English description but none in `locale`, add a
 * machine translation (only when a key is configured; see translate.ts).
 * Returns the ids that changed.
 */
export async function translateMissing(byId: Map<string, Record<string, Summary>>, locale: string): Promise<Set<string>> {
  const changed = new Set<string>();
  if (locale === "en") return changed;
  const items = [...byId.entries()].filter(([, s]) => s.en && !s[locale]).map(([id, s]) => ({ id, text: s.en.text }));
  const translated = await translateTexts(items, "en", locale);
  for (const [id, text] of translated) {
    const s = byId.get(id)!;
    s[locale] = { text, url: s.en.url, translatedFrom: "en" };
    changed.add(id);
  }
  return changed;
}

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
  // Merge what came back, then translate what is still missing in the UI language.
  const merged = new Map<string, Record<string, Summary>>();
  for (const p of places) {
    const s = { ...(p.summary ?? {}), ...(results.get(p.id) ?? {}) };
    if (Object.keys(s).length) merged.set(p.id, s);
  }
  const uiLocale = locales[0];
  const translated = await translateMissing(merged, uiLocale);
  const changed = new Set([...results.keys(), ...translated]);
  if (changed.size === 0) return places;
  const out = places.map((p) => (changed.has(p.id) ? { ...p, summary: merged.get(p.id) } : p));
  // Persist for next time (fire and forget; seed places have no row until something caches them).
  void Promise.all(
    out
      .filter((p) => changed.has(p.id))
      .map((p) => prisma.place.updateMany({ where: { id: p.id }, data: { summary: JSON.stringify(p.summary) } }).catch(() => undefined)),
  );
  return out;
}
