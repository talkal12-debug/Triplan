import "server-only";
import { z } from "zod";
import { airportForCityName, nearestAirport, type Airport } from "@/lib/data/airports";
import { fetchJson, USER_AGENT } from "@/lib/providers/http";

const NOMINATIM = process.env.NOMINATIM_URL || "https://nominatim.openstreetmap.org";
const schema = z.array(z.object({ lat: z.string(), lon: z.string() }));

/**
 * The traveller's home city as typed ("Tel Aviv", "תל אביב", "Haifa") to the airport
 * flight sites need. The airport list only knows English names, so anything else is
 * geocoded once (Nominatim, cached a day) and the nearest big airport is taken. Null
 * when neither works: the links then fall back to city names or are left out.
 */
export async function originAirport(origin: string): Promise<Airport | null> {
  const typed = origin.trim();
  if (typed.length < 2) return null;
  const byName = airportForCityName(typed);
  if (byName) return byName;
  try {
    const params = new URLSearchParams({ q: typed, format: "jsonv2", limit: "1", featuretype: "settlement", "accept-language": "en" });
    const url = `${NOMINATIM}/search?${params}`;
    const hits = await fetchJson(url, { provider: "nominatim", schema, cacheKey: url, ttlMs: 24 * 60 * 60 * 1000, timeoutMs: 6_000, init: { headers: { "User-Agent": USER_AGENT } } });
    const hit = hits[0];
    return hit ? nearestAirport({ lat: Number(hit.lat), lng: Number(hit.lon) }) : null;
  } catch {
    return null;
  }
}
