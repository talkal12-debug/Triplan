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
import { fetchSummariesBatch } from "../src/lib/providers/summaries-core";

const args = process.argv.slice(2);
const refreshPlain = args.includes("--refresh-plain");
const only = args.find((a) => !a.startsWith("--"))?.toLowerCase();
const dir = join(process.cwd(), "data", "pois");
const langs = ["he", "en"];

async function run(cc: string) {
  const file = join(dir, `${cc}.json`);
  const data = poisFileSchema.parse(JSON.parse(readFileSync(file, "utf8")));
  let filled = 0;
  let missing = 0;
  const needs = (p: (typeof data.places)[number], l: string) => !p.summary?.[l] || (refreshPlain && p.summary[l].url === null);
  const todo = data.places.filter((p) => p.wikidata && langs.some((l) => needs(p, l)));
  const results = await fetchSummariesBatch(todo.map((p) => ({ id: p.id, wikidata: p.wikidata!, locales: langs.filter((l) => needs(p, l)) })));
  for (const p of todo) {
    const got = results.get(p.id);
    if (got && Object.keys(got).length) {
      p.summary = { ...(p.summary ?? {}), ...got };
      filled++;
    } else missing++;
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
