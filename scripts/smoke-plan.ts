/**
 * Prints a generated plan for eyeballing. Usage: npx tsx scripts/smoke-plan.ts [PT|IT|JP] [days]
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { poisFileSchema } from "../src/lib/data/schemas";
import { defaultTripPreferences, generateItinerary, type TripPreferences } from "../src/lib/planner";

const code = (process.argv[2] ?? "PT").toUpperCase();
const days = Number(process.argv[3] ?? 6);
const file = poisFileSchema.parse(JSON.parse(readFileSync(join(process.cwd(), "data", "pois", `${code.toLowerCase()}.json`), "utf8")));

const prefs: TripPreferences = {
  ...defaultTripPreferences(new Date("2026-09-04")),
  destinations: [{ countryCode: code, cities: [] }],
  dates: { start: "2026-10-16", days, arrivalTime: "11:30", departureTime: "18:00" },
};

const t0 = Date.now();
const { itinerary, diagnostics } = generateItinerary({ prefs, places: file.places, cities: file.cities });
const ms = Date.now() - t0;
const byId = new Map(file.places.map((p) => [p.id, p]));
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

console.log(`${code} ${days} days, ${itinerary.baseMode}, ${ms} ms, walk ${itinerary.stats.totalWalkKm} km, ${itinerary.stats.places} places, verified ${itinerary.stats.verifiedShare}`);
console.log("stays:", itinerary.stays.map((s) => `${s.citySlug} d${s.fromDay}-${s.toDay}`).join(" | "));
for (const day of itinerary.days) {
  console.log(`\nDay ${day.index + 1} ${day.date} [${day.kind}] ${day.citySlug} theme=${day.theme} walk=${day.stats.walkKm}km load=${day.stats.load} ${day.stats.intensity} museums=${day.stats.museums}`);
  for (const a of day.activities) {
    const name = a.placeId ? byId.get(a.placeId)?.names.en : a.kind;
    const tr = a.transitFromPrev ? ` (${a.transitFromPrev.mode} ${a.transitFromPrev.minutes}m)` : "";
    const why = a.reasons.map((r) => r.code).join(",");
    console.log(`  ${hhmm(a.startMin)}-${hhmm(a.endMin)} ${name}${tr}  [${why}]`);
  }
  if (day.rainPlan.length) console.log(`  rain: ${day.rainPlan.map((id) => byId.get(id)?.names.en).join(", ")}`);
  for (const w of day.warnings) console.log(`  ! ${w.code} ${JSON.stringify(w.params)}`);
}
console.log("\ntrip warnings:", itinerary.warnings.map((w) => `${w.code}${w.dayIndex !== undefined ? "@" + w.dayIndex : ""}`).join(", ") || "none");
console.log("budget:", diagnostics.budget);
console.log("excluded:", diagnostics.excluded.length, "unused:", diagnostics.unused.length);
