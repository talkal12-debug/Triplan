/**
 * Builds data/airports.json from OurAirports (public domain): airports with an
 * IATA code and scheduled service, large + medium. Used to turn a city into an
 * airport code for flight deep links (Skyscanner needs codes, not names).
 *
 * Usage: npm run data:airports   (network; run once, commit the file)
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const res = await fetch("https://davidmegginson.github.io/ourairports-data/airports.csv");
if (!res.ok) throw new Error(`ourairports: ${res.status}`);
const csv = await res.text();

/** Minimal CSV parser (quoted fields with commas). */
function parseLine(line) {
  const out = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (q && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else q = !q;
    } else if (ch === "," && !q) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

const lines = csv.split("\n").filter(Boolean);
const header = parseLine(lines[0]);
const col = (name) => header.indexOf(name);
const c = { type: col("type"), name: col("name"), lat: col("latitude_deg"), lng: col("longitude_deg"), iso: col("iso_country"), city: col("municipality"), sched: col("scheduled_service"), iata: col("iata_code") };

const airports = [];
for (const line of lines.slice(1)) {
  const f = parseLine(line);
  const type = f[c.type];
  if ((type !== "large_airport" && type !== "medium_airport") || f[c.sched] !== "yes" || !f[c.iata]) continue;
  airports.push({
    iata: f[c.iata],
    name: f[c.name],
    city: f[c.city] || "",
    country: f[c.iso],
    lat: Number(Number(f[c.lat]).toFixed(4)),
    lng: Number(Number(f[c.lng]).toFixed(4)),
    large: type === "large_airport",
  });
}
airports.sort((a, b) => a.iata.localeCompare(b.iata));
writeFileSync(join(process.cwd(), "data", "airports.json"), JSON.stringify(airports) + "\n");
console.log(`${airports.length} airports (${airports.filter((a) => a.large).length} large)`);
