/**
 * Restaurants, cafés, bars, theatres and viewpoints around every curated
 * attraction of the demo destinations, from OpenStreetMap (Overpass), saved to
 * data/venues/{cc}.json so the live site never has to reach Overpass for them
 * (the public instances refuse or stall connections from cloud hosting).
 *
 * Per attraction: everything with a name within 1.6 km, ranked by how complete
 * the OSM record is, keeping the best 40 food and 25 evening entries.
 *
 * Usage: npm run data:venues [CC]   (network; a few minutes per country)
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { poisFileSchema } from "../src/lib/data/schemas";
import { classifyVenue, distanceMeters, venueCompleteness, venueHints, type VenueKind } from "../src/lib/nearby/schema";

const INSTANCES = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter", "https://overpass.private.coffee/api/interpreter"];
const RADIUS = 1600;
const FOOD = `["amenity"~"^(restaurant|cafe|food_court|fast_food|ice_cream)$"]["name"]`;
const EVENING = `["amenity"~"^(bar|pub|biergarten|nightclub|theatre|cinema|music_venue|concert_hall|arts_centre|events_venue|casino)$"]["name"]`;
const VIEW = `["tourism"="viewpoint"]["name"]`;
const foodKinds: VenueKind[] = ["restaurant", "cafe", "fast_food", "ice_cream"];

type Element = { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> };
type StoredVenue = { id: string; name: string; kind: VenueKind; cuisine: string | null; lat: number; lng: number; openingHours: string | null; website: string | null; wikidata: string | null; hints: string[]; score: number };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function overpass(query: string): Promise<Element[]> {
  let lastErr: unknown;
  for (const base of INSTANCES) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(`${base}?data=${encodeURIComponent(query)}`, { headers: { "User-Agent": "Triplan/1.0 (data build; talkal12@gmail.com)" }, signal: AbortSignal.timeout(150_000) });
        if (res.status === 429 || res.status === 504) {
          await sleep(15_000);
          continue;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return ((await res.json()) as { elements: Element[] }).elements;
      } catch (err) {
        lastErr = err;
        await sleep(5_000);
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("overpass failed");
}

function toStored(el: Element): StoredVenue | null {
  const tags = el.tags ?? {};
  const kind = classifyVenue(tags);
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  if (!kind || !tags.name || lat === undefined || lng === undefined) return null;
  return {
    id: `${el.type}/${el.id}`,
    name: tags.name,
    kind,
    cuisine: tags.cuisine ? tags.cuisine.split(";")[0].replace(/_/g, " ") : null,
    lat,
    lng,
    openingHours: tags.opening_hours ?? null,
    website: tags.website ?? tags["contact:website"] ?? null,
    wikidata: tags.wikidata ?? null,
    hints: venueHints(tags),
    score: venueCompleteness(tags),
  };
}

async function run(cc: string) {
  const data = poisFileSchema.parse(JSON.parse(readFileSync(join("data", "pois", `${cc}.json`), "utf8")));
  const kept = new Map<string, StoredVenue>();
  const places = data.places;
  // Dense cities (Rome, Tokyo) time out on big unions: a few places at a time, split further on failure.
  const fetchChunk = async (chunk: typeof places): Promise<Element[]> => {
    const parts = chunk.flatMap((p) => {
      const around = `(around:${RADIUS},${p.lat.toFixed(5)},${p.lng.toFixed(5)})`;
      return [`nwr${FOOD}${around};`, `nwr${EVENING}${around};`, `nwr${VIEW}${around};`];
    });
    const query = `[out:json][timeout:120];\n(\n${parts.join("\n")}\n);\nout center tags;`;
    try {
      return await overpass(query);
    } catch (err) {
      if (chunk.length === 1) throw err;
      const half = Math.ceil(chunk.length / 2);
      console.log(`  retrying in halves (${chunk.length} -> ${half})`);
      return [...(await fetchChunk(chunk.slice(0, half))), ...(await fetchChunk(chunk.slice(half)))];
    }
  };
  const STEP = 3;
  for (let i = 0; i < places.length; i += STEP) {
    const chunk = places.slice(i, i + STEP);
    process.stdout.write(`${cc}: places ${i + 1}-${i + chunk.length} of ${places.length}... `);
    const elements = await fetchChunk(chunk);
    const venues = elements.map(toStored).filter((v): v is StoredVenue => v !== null);
    console.log(`${elements.length} elements`);
    for (const p of chunk) {
      const near = venues.filter((v) => distanceMeters(p, v) <= RADIUS).sort((a, b) => b.score - a.score || distanceMeters(p, a) - distanceMeters(p, b));
      const food = near.filter((v) => foodKinds.includes(v.kind)).slice(0, 40);
      const evening = near.filter((v) => !foodKinds.includes(v.kind) || v.kind === "ice_cream").slice(0, 25);
      for (const v of [...food, ...evening]) kept.set(v.id, v);
    }
    await sleep(3_000);
  }
  mkdirSync(join("data", "venues"), { recursive: true });
  const out = { version: 1, generatedAt: new Date().toISOString().slice(0, 10), source: "OpenStreetMap via Overpass (ODbL)", venues: [...kept.values()] };
  writeFileSync(join("data", "venues", `${cc}.json`), JSON.stringify(out) + "\n");
  console.log(`${cc}: ${out.venues.length} venues saved`);
}

async function main() {
  const only = process.argv[2]?.toLowerCase();
  for (const cc of only ? [only] : ["pt", "it", "jp"]) await run(cc);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
