/**
 * Fills `summary` (he + en) for the curated demo POIs from Wikipedia / Wikidata,
 * so the seed ships with descriptions and no request is needed at plan time.
 * Other UI languages are fetched on demand when a plan uses the place.
 *
 * Usage: npm run data:summaries [CC] [--refresh-plain]
 * (network; Wikimedia is rate-limited, so requests are paced; --refresh-plain re-fetches
 * entries that only have the short Wikidata description, in case the article was skipped)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { poisFileSchema } from "../src/lib/data/schemas";
import { fetchPageImage, fetchSummariesBatch } from "../src/lib/providers/summaries-core";

const args = process.argv.slice(2);
const refreshPlain = args.includes("--refresh-plain");
const images = args.includes("--images");
const only = args.find((a) => !a.startsWith("--"))?.toLowerCase();
const dir = join(process.cwd(), "data", "pois");
const langs = ["he", "en"];

async function run(cc: string) {
  const file = join(dir, `${cc}.json`);
  const data = poisFileSchema.parse(JSON.parse(readFileSync(file, "utf8")));
  let filled = 0;
  let missing = 0;
  const hasImage = (p: (typeof data.places)[number]) => Object.values(p.summary ?? {}).some((s) => s.image);
  const needs = (p: (typeof data.places)[number], l: string) => !p.summary?.[l] || (refreshPlain && p.summary[l].url === null) || (images && !hasImage(p) && p.summary[l].url !== null);
  const todo = data.places.filter((p) => p.wikidata && langs.some((l) => needs(p, l)));
  const results = await fetchSummariesBatch(todo.map((p) => ({ id: p.id, wikidata: p.wikidata!, locales: langs.filter((l) => needs(p, l)) })));
  for (const p of todo) {
    const got = results.get(p.id);
    if (got && Object.keys(got).length) {
      // Merge: keep hand-made translations, add what came back (text, url, image).
      const merged = { ...(p.summary ?? {}) };
      for (const [l, v] of Object.entries(got)) {
        const prev = merged[l];
        merged[l] = prev?.translatedFrom ? { ...prev, image: prev.image ?? v.image ?? null } : v;
      }
      p.summary = merged;
      filled++;
    } else missing++;
  }
  if (images) {
    for (const city of data.cities) {
      if (city.image) continue;
      // "Sintra & Cascais" is our area name, not an article: try the full name, then the first place in it.
      // Ambiguous titles need the article name Wikipedia actually uses.
      const known: Record<string, string> = { tivoli: "Tivoli, Lazio" };
      const candidates = [known[city.slug], city.names.en, city.names.en.split(/\s*(?:&|,| and )\s*/)[0], city.names.local].filter((v, i, all): v is string => Boolean(v) && all.indexOf(v) === i);
      for (const title of candidates) {
        city.image = await fetchPageImage("en", title);
        if (city.image) break;
        await new Promise((r) => setTimeout(r, 300));
      }
      await new Promise((r) => setTimeout(r, 300));
    }
    console.log(`${cc}: city photos ${data.cities.filter((c) => c.image).length}/${data.cities.length}, places with a photo ${data.places.filter(hasImage).length}/${data.places.length}`);
  }
  writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
  const withHe = data.places.filter((p) => p.summary?.he).length;
  const withEn = data.places.filter((p) => p.summary?.en).length;
  console.log(`${cc}: ${filled} fetched, ${missing} without source, now ${withHe}/${data.places.length} he and ${withEn}/${data.places.length} en`);
}

async function main() {
  for (const cc of only ? [only] : ["pt", "it", "jp"]) await run(cc);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
