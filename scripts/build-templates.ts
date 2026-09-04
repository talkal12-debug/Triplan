/**
 * Builds the gallery templates by calling the running app's planner
 * (POST /api/plan) and writing the result to data/templates/<id>.json.
 *
 * Usage: npm run dev   (in another terminal)
 *        npm run data:templates
 * Each template is a full plan snapshot, so the gallery works offline and
 * without a database. Rebuild after changing the seed data or the engine.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { defaultTripPreferences, type TripPreferences } from "../src/lib/planner/types";
import { templateSchema } from "../src/lib/templates/schema";

const base = process.env.TRIPLAN_URL ?? "http://localhost:3000";
const outDir = join(process.cwd(), "data", "templates");

type Spec = { id: string; patch: (p: TripPreferences) => TripPreferences };

const start = "2026-05-04"; // a Monday in spring; copies are moved to the traveller's own dates

const specs: Spec[] = [
  {
    id: "lisbon-family-5",
    patch: (p) => ({
      ...p,
      destinations: [{ countryCode: "PT", cities: ["lisbon", "sintra"] }],
      dates: { ...p.dates, start, days: 5 },
      party: { adults: 2, childrenAges: [6, 9], infants: 0, stroller: false, seniors: 0 },
      effort: "medium",
      interests: ["kids", "beaches", "history", "food"],
      transport: { walk: 2, bike: 0, car: 0, transit: 3, tours: 1 },
      hotel: { ...p.hotel, type: "apartment", location: "center", baseMode: "single" },
    }),
  },
  {
    id: "rome-first-time-4",
    patch: (p) => ({
      ...p,
      destinations: [{ countryCode: "IT", cities: ["rome"] }],
      dates: { ...p.dates, start, days: 4 },
      party: { adults: 2, childrenAges: [], infants: 0, stroller: false, seniors: 0 },
      visitNumber: 1,
      effort: "high",
      interests: ["history", "food", "museums", "photography"],
      transport: { walk: 3, bike: 0, car: 0, transit: 2, tours: 1 },
      budget: { ...p.budget, level: "mid" },
      hotel: { ...p.hotel, type: "3star", location: "center", baseMode: "single" },
    }),
  },
  {
    id: "tokyo-week-7",
    patch: (p) => ({
      ...p,
      destinations: [{ countryCode: "JP", cities: ["tokyo", "kamakura-hakone"] }],
      dates: { ...p.dates, start, days: 7 },
      party: { adults: 2, childrenAges: [], infants: 0, stroller: false, seniors: 0 },
      effort: "medium",
      interests: ["city", "food", "shopping", "history", "nature"],
      transport: { walk: 2, bike: 0, car: 0, transit: 3, tours: 0 },
      budget: { ...p.budget, level: "mid" },
      hotel: { ...p.hotel, type: "4star", location: "station", baseMode: "single" },
    }),
  },
  {
    id: "porto-lisbon-relaxed-6",
    patch: (p) => ({
      ...p,
      destinations: [{ countryCode: "PT", cities: ["porto", "lisbon"] }],
      dates: { ...p.dates, start, days: 6 },
      party: { adults: 2, childrenAges: [], infants: 0, stroller: false, seniors: 2 },
      effort: "low",
      accessibility: ["stairs"],
      interests: ["wine", "food", "history", "city"],
      transport: { walk: 1, bike: 0, car: 0, transit: 2, tours: 3 },
      budget: { ...p.budget, level: "luxury" },
      hotel: { ...p.hotel, type: "boutique", location: "center", baseMode: "multi" },
    }),
  },
];

async function build(spec: Spec) {
  const preferences = spec.patch(defaultTripPreferences(new Date(`${start}T00:00:00Z`)));
  const res = await fetch(`${base}/api/plan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ preferences, locale: "he" }),
  });
  if (!res.ok) throw new Error(`${spec.id}: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { itinerary: unknown; places: unknown; cities: unknown; extras?: unknown; diagnostics: { unused: string[] } };
  const template = templateSchema.parse({
    id: spec.id,
    preferences,
    plan: { itinerary: data.itinerary, places: data.places, cities: data.cities, unused: data.diagnostics.unused, extras: data.extras },
    generatedAt: new Date().toISOString(),
  });
  writeFileSync(join(outDir, `${spec.id}.json`), JSON.stringify(template) + "\n");
  console.log(`${spec.id}: ${template.plan.itinerary.stats.places} places, ${template.plan.itinerary.days.length} days`);
}

async function main() {
  mkdirSync(outDir, { recursive: true });
  for (const spec of specs) await build(spec);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
