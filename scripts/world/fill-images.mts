/**
 * Cities without a photo (ambiguous English names like "Bath" or "Split" land on a
 * disambiguation page): find the city's Wikidata item through Nominatim, follow its
 * English Wikipedia sitelink to the exact article, and take that article's lead photo.
 * Then fill any missing names from the same article's interlanguage links.
 * Usage: npx tsx scripts/world/fill-images.mts
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { poisFileSchema, type CitySeed } from "../../src/lib/data/schemas.ts";
import { fetchPageImage } from "../../src/lib/providers/summaries-core.ts";
import { fillCityNames } from "./names.ts";
import { worldCities } from "./cities.ts";
import { slugify } from "../../src/lib/providers/pois/osm-core.ts";

const UA = "Triplan-world-build/0.1 (talkal12@gmail.com)";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function enTitleFor(city: CitySeed): Promise<string | null> {
  const spec = worldCities.find((s) => s.cc === city.countryCode && slugify(s.en) === city.slug);
  const q = spec?.q ?? spec?.en ?? city.names.en;
  await sleep(1100);
  const params = new URLSearchParams({ q, countrycodes: city.countryCode.toLowerCase(), format: "jsonv2", limit: "5", extratags: "1" });
  const hits = (await (await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { headers: { "User-Agent": UA } })).json()) as { lat: string; lon: string; extratags?: Record<string, string> | null }[];
  // The hit at our centre (the one the build chose), else the first with a Wikidata id.
  const near = (h: { lat: string; lon: string }) => Math.abs(Number(h.lat) - city.center.lat) + Math.abs(Number(h.lon) - city.center.lng) < 0.05;
  const hit = hits.find((h) => near(h) && h.extratags?.wikidata) ?? hits.find((h) => h.extratags?.wikidata);
  const qid = hit?.extratags?.wikidata;
  if (!qid) return null;
  const res = await fetch(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qid}&props=sitelinks&sitefilter=enwiki&format=json`, { headers: { "User-Agent": UA } });
  const data = (await res.json()) as { entities?: Record<string, { sitelinks?: { enwiki?: { title: string } } }> };
  return data.entities?.[qid]?.sitelinks?.enwiki?.title ?? null;
}

const dir = join(process.cwd(), "data", "world");
for (const f of readdirSync(dir).filter((x) => x.endsWith(".json"))) {
  const data = poisFileSchema.parse(JSON.parse(readFileSync(join(dir, f), "utf8")));
  const missing = data.cities.filter((c) => !c.image);
  if (missing.length === 0) continue;
  let fixed = 0;
  for (const city of missing) {
    const title = await enTitleFor(city).catch(() => null);
    if (!title) {
      console.log(`${f} ${city.slug}: no Wikidata link`);
      continue;
    }
    city.image = await fetchPageImage("en", title).catch(() => null);
    if (city.image) fixed++;
    console.log(`${f} ${city.slug}: ${title} -> ${city.image ? "photo" : "no photo in that article"}`);
  }
  const names = await fillCityNames(data.cities);
  writeFileSync(join(dir, f), JSON.stringify(data) + "\n");
  console.log(`${f}: ${fixed}/${missing.length} photos, ${names} names added`);
}
