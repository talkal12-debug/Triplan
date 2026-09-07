import "server-only";
import airportsJson from "../../../data/airports.json";
import { haversineKm } from "@/lib/planner/geo";
import { hubFor } from "./metro-codes";

/**
 * Commercial airports with IATA codes (OurAirports, public domain; see
 * scripts/fetch-airports.mjs). Flight sites such as Skyscanner take airport
 * codes, not city names, so a destination city becomes its nearest big airport
 * and the traveller's home city is matched by name.
 */
export type Airport = { iata: string; name: string; city: string; country: string; lat: number; lng: number; large: boolean };

const airports = airportsJson as Airport[];

/** Nearest airport to a point: large ones within 150 km first, then medium within 100 km. */
export function nearestAirport(point: { lat: number; lng: number }): Airport | null {
  let best: { a: Airport; km: number } | null = null;
  for (const a of airports) {
    const km = haversineKm(point, a);
    const limit = a.large ? 150 : 100;
    if (km > limit) continue;
    // A large airport wins over a slightly closer medium one.
    const score = a.large ? km : km + 60;
    if (!best || score < best.km) best = { a, km: score };
  }
  if (!best) return null;
  // Rome's nearest is Ciampino, London's may be City: flight sites should get the city's main hub instead.
  const hub = hubFor(best.a.iata);
  const main = hub && hub !== best.a.iata ? airports.find((a) => a.iata === hub) : undefined;
  return main && haversineKm(point, main) <= 150 ? main : best.a;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();

/** Airport for a city typed by the traveller ("Tel Aviv", "London"): by municipality, large first. Null when unknown. */
export function airportForCityName(city: string): Airport | null {
  const q = norm(city);
  if (q.length < 3) return null;
  if (/^[a-z]{3}$/.test(q)) {
    const byCode = airports.find((a) => a.iata.toLowerCase() === q);
    if (byCode) return byCode;
  }
  const matches = airports.filter((a) => norm(a.city) === q || norm(a.name).includes(q));
  matches.sort((a, b) => Number(b.large) - Number(a.large) || (norm(a.city) === q ? -1 : 1));
  return matches[0] ?? null;
}
