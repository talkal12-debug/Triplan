import { z } from "zod";

/**
 * Place descriptions from free sources, per language (no server-only imports so
 * the seed script can use it too):
 * 1. the Wikipedia article linked from the place's Wikidata item (REST summary, CC BY-SA, with its URL),
 * 2. otherwise the short Wikidata description in that language,
 * 3. otherwise nothing. Nothing is ever generated.
 *
 * Wikimedia rate-limits eager clients (HTTP 429), so Wikidata items are fetched
 * 50 per request and Wikipedia pages one after another with a short pause.
 */
export type Summary = { text: string; url: string | null; translatedFrom?: string };

const WIKIDATA = "https://www.wikidata.org/w/api.php";
const USER_AGENT = "Triplan/1.0 (trip planner; contact via repository)";
const MAX_CHARS = 280;
const PAUSE_MS = 120;

const entitySchema = z.object({
  entities: z.record(
    z.string(),
    z.object({
      sitelinks: z.record(z.string(), z.object({ title: z.string() })).optional(),
      descriptions: z.record(z.string(), z.object({ value: z.string() })).optional(),
    }),
  ),
});
type Entity = z.infer<typeof entitySchema>["entities"][string];

const summarySchema = z.object({
  extract: z.string().optional(),
  content_urls: z.object({ desktop: z.object({ page: z.string() }) }).optional(),
  type: z.string().optional(),
});

/** First one or two sentences (parentheticals removed), capped, so a card stays a card. */
export function trimExtract(text: string): string {
  const clean = text.replace(/\s+/g, " ").replace(/\s*\([^)]*\)/g, "").trim();
  const sentences = clean.match(/[^.!?。]+[.!?。]?/g) ?? [clean];
  let out = "";
  let count = 0;
  for (const s of sentences) {
    if (count >= 2 || (out && (out + s).length > MAX_CHARS)) break;
    out += s;
    count++;
  }
  return (out.length > MAX_CHARS ? `${out.slice(0, MAX_CHARS - 1).trimEnd()}…` : out).trim();
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getJson<T>(url: string, schema: z.ZodType<T>, timeoutMs = 8_000): Promise<T | null> {
  // Wikimedia answers 429 when asked too quickly: back off and retry a few times (Retry-After when given).
  for (let attempt = 0; attempt < 4; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" }, signal: controller.signal });
      if (res.status === 429) {
        const retryAfter = Number(res.headers.get("retry-after")) || 0;
        await sleep(Math.max(retryAfter * 1000, 3_000 * (attempt + 1)));
        continue;
      }
      if (!res.ok) return null;
      const parsed = schema.safeParse(await res.json());
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

/** Wikipedia language code for a UI locale. */
export const wikiLang = (locale: string) => (locale === "zh-CN" ? "zh" : locale);

/** Wikidata items 50 per request: sitelinks + descriptions in the given locales. */
async function fetchEntities(ids: string[], locales: string[]): Promise<Map<string, Entity>> {
  const out = new Map<string, Entity>();
  const langs = [...new Set(locales.map(wikiLang))];
  const unique = [...new Set(ids)];
  for (let i = 0; i < unique.length; i += 50) {
    const batch = unique.slice(i, i + 50);
    const url = `${WIKIDATA}?action=wbgetentities&ids=${batch.join("|")}&props=sitelinks|descriptions&languages=${langs.join("|")}&sitefilter=${langs.map((l) => `${l}wiki`).join("|")}&format=json`;
    const data = await getJson(url, entitySchema);
    for (const [id, e] of Object.entries(data?.entities ?? {})) out.set(id, e);
    if (i + 50 < unique.length) await sleep(PAUSE_MS);
  }
  return out;
}

async function summariesFromEntity(entity: Entity, locales: string[]): Promise<Record<string, Summary>> {
  const out: Record<string, Summary> = {};
  for (const locale of locales) {
    const lang = wikiLang(locale);
    const title = entity.sitelinks?.[`${lang}wiki`]?.title;
    if (title) {
      const page = await getJson(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`, summarySchema);
      await sleep(PAUSE_MS);
      if (page?.extract && page.type !== "disambiguation") {
        out[locale] = { text: trimExtract(page.extract), url: page.content_urls?.desktop.page ?? null };
        continue;
      }
      // The article exists but could not be fetched now (rate limit, timeout): leave the
      // locale empty so a later attempt gets the real lead instead of freezing the short fallback.
      if (!page) continue;
    }
    const d = entity.descriptions?.[lang]?.value;
    if (d) out[locale] = { text: d.charAt(0).toUpperCase() + d.slice(1), url: null };
  }
  return out;
}

/**
 * Summaries for many places at once, keyed by place id. `items` carry the
 * Wikidata id and the locales still missing for that place. Sequential and
 * paced, so a plan with 40 places takes a few seconds and never a 429.
 */
export async function fetchSummariesBatch(items: { id: string; wikidata: string; locales: string[] }[]): Promise<Map<string, Record<string, Summary>>> {
  const out = new Map<string, Record<string, Summary>>();
  if (items.length === 0) return out;
  const allLocales = [...new Set(items.flatMap((i) => i.locales))];
  const entities = await fetchEntities(
    items.map((i) => i.wikidata),
    allLocales,
  );
  for (const item of items) {
    const entity = entities.get(item.wikidata);
    if (!entity) continue;
    const got = await summariesFromEntity(entity, item.locales);
    if (Object.keys(got).length) out.set(item.id, got);
  }
  return out;
}

/** Convenience for one item. */
export async function fetchSummaries(wikidataId: string, locales: string[]): Promise<Record<string, Summary>> {
  return (await fetchSummariesBatch([{ id: wikidataId, wikidata: wikidataId, locales }])).get(wikidataId) ?? {};
}
