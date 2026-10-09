/**
 * City names in every UI language from Wikipedia's interlanguage links: the
 * English article of the city (its photo credit page, else its English name)
 * links to the Hebrew, Arabic, Japanese... articles, whose titles are the names
 * readers of that language use. Parenthetical disambiguators are dropped
 * ("Lecce (city)" -> "Lecce"). Only missing names are filled.
 */
import type { CitySeed } from "../../src/lib/data/schemas";

const UA = "Triplan/1.0 (https://triplan-rho.vercel.app; trip planner)";
/** UI locale -> Wikipedia language. */
const LANGS: Record<string, string> = { he: "he", ar: "ar", ru: "ru", es: "es", fr: "fr", de: "de", it: "it", pt: "pt", ja: "ja", "zh-CN": "zh", hi: "hi" };

export function cleanTitle(title: string): string {
  return title.replace(/\s*\([^)]*\)\s*$/, "").trim();
}

function enTitle(city: CitySeed): string {
  const page = city.image?.page;
  if (page && page.includes("en.wikipedia.org/wiki/")) return decodeURIComponent(page.split("/wiki/")[1]).replace(/_/g, " ");
  return city.names.en;
}

/** Fills names[locale] for every UI language that is missing one. Returns how many names were added. */
export async function fillCityNames(cities: CitySeed[]): Promise<number> {
  let added = 0;
  const byTitle = new Map<string, CitySeed[]>();
  for (const c of cities) byTitle.set(enTitle(c), [...(byTitle.get(enTitle(c)) ?? []), c]);
  const titles = [...byTitle.keys()];
  for (const [locale, lang] of Object.entries(LANGS)) {
    const need = titles.filter((t) => byTitle.get(t)!.some((c) => !c.names[locale]));
    for (let i = 0; i < need.length; i += 50) {
      const batch = need.slice(i, i + 50);
      const params = new URLSearchParams({ action: "query", format: "json", formatversion: "2", prop: "langlinks", lllang: lang, lllimit: "500", redirects: "1", titles: batch.join("|") });
      const res = await fetch(`https://en.wikipedia.org/w/api.php?${params}`, { headers: { "User-Agent": UA } });
      if (!res.ok) continue;
      const data = (await res.json()) as {
        query?: { normalized?: { from: string; to: string }[]; redirects?: { from: string; to: string }[]; pages?: { title: string; langlinks?: { lang: string; title: string }[] }[] };
      };
      const q = data.query;
      if (!q?.pages) continue;
      const resolve = (t: string) => {
        let x = t;
        for (const n of q.normalized ?? []) if (n.from === x) x = n.to;
        for (const r of q.redirects ?? []) if (r.from === x) x = r.to;
        return x;
      };
      const pages = new Map(q.pages.map((p) => [p.title, p]));
      for (const title of batch) {
        const link = pages.get(resolve(title))?.langlinks?.find((l) => l.lang === lang)?.title;
        if (!link) continue;
        for (const c of byTitle.get(title)!) {
          if (c.names[locale]) continue;
          c.names[locale] = cleanTitle(link);
          added++;
        }
      }
      await new Promise((r) => setTimeout(r, 150));
    }
  }
  return added;
}
