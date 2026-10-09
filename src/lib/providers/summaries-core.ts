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
export type Summary = { text: string; url: string | null; translatedFrom?: string; image?: { url: string; page: string | null } | null };

const WIKIDATA = "https://www.wikidata.org/w/api.php";
// Wikimedia throttles generic agents hard (HTTP 429); an agent that names the site and how to reach it is served normally.
const USER_AGENT = "Triplan/1.0 (https://triplan-rho.vercel.app; trip planner)";
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
  thumbnail: z.object({ source: z.string(), width: z.number().optional(), height: z.number().optional() }).optional(),
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

async function getJson<T>(url: string, schema: z.ZodType<T>, timeoutMs = 8_000, deadline = Infinity): Promise<T | null> {
  // Wikimedia answers 429 when asked too quickly: back off and retry a few times (Retry-After when given),
  // unless the caller's deadline has passed.
  for (let attempt = 0; attempt < 4; attempt++) {
    if (Date.now() > deadline) return null;
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
async function fetchEntities(ids: string[], locales: string[], deadline = Infinity): Promise<Map<string, Entity>> {
  const out = new Map<string, Entity>();
  const langs = [...new Set(locales.map(wikiLang))];
  const unique = [...new Set(ids)];
  for (let i = 0; i < unique.length; i += 50) {
    const batch = unique.slice(i, i + 50);
    const url = `${WIKIDATA}?action=wbgetentities&ids=${batch.join("|")}&props=sitelinks|descriptions&languages=${langs.join("|")}&sitefilter=${langs.map((l) => `${l}wiki`).join("|")}&format=json`;
    if (Date.now() > deadline) break;
    const data = await getJson(url, entitySchema, 8_000, deadline);
    for (const [id, e] of Object.entries(data?.entities ?? {})) out.set(id, e);
    if (i + 50 < unique.length) await sleep(PAUSE_MS);
  }
  return out;
}

async function summariesFromEntity(entity: Entity, locales: string[], deadline = Infinity): Promise<Record<string, Summary>> {
  const out: Record<string, Summary> = {};
  for (const locale of locales) {
    if (Date.now() > deadline) break;
    const lang = wikiLang(locale);
    const title = entity.sitelinks?.[`${lang}wiki`]?.title;
    if (title) {
      const page = await getJson(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`, summarySchema, 8_000, deadline);
      await sleep(PAUSE_MS);
      if (page?.extract && page.type !== "disambiguation") {
        const pageUrl = page.content_urls?.desktop.page ?? null;
        out[locale] = { text: trimExtract(page.extract), url: pageUrl, image: page.thumbnail ? { url: page.thumbnail.source, page: pageUrl } : null };
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
export async function fetchSummariesBatch(items: { id: string; wikidata: string; locales: string[] }[], deadlineMs?: number): Promise<Map<string, Record<string, Summary>>> {
  const out = new Map<string, Record<string, Summary>>();
  if (items.length === 0) return out;
  const deadline = deadlineMs ? Date.now() + deadlineMs : Infinity;
  const allLocales = [...new Set(items.flatMap((i) => i.locales))];
  const entities = await fetchEntities(
    items.map((i) => i.wikidata),
    allLocales,
    deadline,
  );
  for (const item of items) {
    // Out of time: the rest is fetched on demand later (the caller never waits forever).
    if (Date.now() > deadline) break;
    const entity = entities.get(item.wikidata);
    if (!entity) continue;
    const got = await summariesFromEntity(entity, item.locales, deadline);
    if (Object.keys(got).length) out.set(item.id, got);
  }
  return out;
}

const actionSchema = z.object({
  query: z
    .object({
      normalized: z.array(z.object({ from: z.string(), to: z.string() })).optional(),
      redirects: z.array(z.object({ from: z.string(), to: z.string() })).optional(),
      pages: z
        .array(
          z.object({
            title: z.string(),
            missing: z.boolean().optional(),
            extract: z.string().optional(),
            thumbnail: z.object({ source: z.string() }).optional(),
            pageprops: z.object({ disambiguation: z.string().optional() }).optional(),
          }),
        )
        .optional(),
    })
    .optional(),
});

/**
 * The same result as fetchSummariesBatch, for many places at once (offline builds):
 * Wikipedia's Action API returns the intro, the lead image and the disambiguation
 * flag for 20 articles per request, so a city of 80 places costs a handful of
 * requests per language instead of one per place. Redirects are followed.
 */
export async function fetchSummariesBulk(items: { id: string; wikidata: string; locales: string[] }[]): Promise<Map<string, Record<string, Summary>>> {
  const out = new Map<string, Record<string, Summary>>();
  if (items.length === 0) return out;
  const allLocales = [...new Set(items.flatMap((i) => i.locales))];
  const entities = await fetchEntities(
    items.map((i) => i.wikidata),
    allLocales,
  );
  const set = (id: string, locale: string, summary: Summary) => out.set(id, { ...(out.get(id) ?? {}), [locale]: summary });
  for (const locale of allLocales) {
    const lang = wikiLang(locale);
    const byTitle = new Map<string, string[]>();
    for (const item of items) {
      if (!item.locales.includes(locale)) continue;
      const title = entities.get(item.wikidata)?.sitelinks?.[`${lang}wiki`]?.title;
      if (title) byTitle.set(title, [...(byTitle.get(title) ?? []), item.id]);
    }
    const titles = [...byTitle.keys()];
    for (let i = 0; i < titles.length; i += 20) {
      const batch = titles.slice(i, i + 20);
      const params = new URLSearchParams({
        action: "query",
        format: "json",
        formatversion: "2",
        prop: "extracts|pageimages|pageprops",
        exintro: "1",
        explaintext: "1",
        exlimit: "20",
        piprop: "thumbnail",
        pithumbsize: "330",
        pilimit: "20",
        ppprop: "disambiguation",
        redirects: "1",
        titles: batch.join("|"),
      });
      const data = await getJson(`https://${lang}.wikipedia.org/w/api.php?${params}`, actionSchema, 15_000);
      const q = data?.query;
      if (!q?.pages) continue;
      const resolve = (t: string) => {
        let x = t;
        for (const n of q.normalized ?? []) if (n.from === x) x = n.to;
        for (const r of q.redirects ?? []) if (r.from === x) x = r.to;
        return x;
      };
      const pages = new Map(q.pages.map((p) => [p.title, p]));
      for (const title of batch) {
        const page = pages.get(resolve(title));
        if (!page || page.missing || page.pageprops?.disambiguation !== undefined || !page.extract?.trim()) continue;
        const url = `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, "_"))}`;
        const summary: Summary = { text: trimExtract(page.extract), url, image: page.thumbnail ? { url: page.thumbnail.source, page: url } : null };
        for (const id of byTitle.get(title) ?? []) set(id, locale, summary);
      }
      await sleep(PAUSE_MS);
    }
  }
  // No article in that language: the short Wikidata description, as the per-place path does.
  for (const item of items) {
    const entity = entities.get(item.wikidata);
    for (const locale of item.locales) {
      if (out.get(item.id)?.[locale]) continue;
      const d = entity?.descriptions?.[wikiLang(locale)]?.value;
      if (d) set(item.id, locale, { text: d.charAt(0).toUpperCase() + d.slice(1), url: null });
    }
  }
  return out;
}

/** Convenience for one item. */
export async function fetchSummaries(wikidataId: string, locales: string[]): Promise<Record<string, Summary>> {
  return (await fetchSummariesBatch([{ id: wikidataId, wikidata: wikidataId, locales }])).get(wikidataId) ?? {};
}

/** Lead photo of a Wikipedia article by title (used for city photos). */
export async function fetchPageImage(lang: string, title: string): Promise<{ url: string; page: string | null } | null> {
  const page = await getJson(`https://${wikiLang(lang)}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`, summarySchema);
  return page?.thumbnail ? { url: page.thumbnail.source, page: page.content_urls?.desktop.page ?? null } : null;
}
