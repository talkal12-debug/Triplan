import { NextResponse } from "next/server";
import { getSeedCities, getSeedPlaces } from "@/lib/data/pois";
import { getWorldCities, getWorldPlaces, hasWorldCountry } from "@/lib/data/world";
import { isDemoCountry, getCountry } from "@/lib/data/countries";
import { isLocale } from "@/lib/i18n/locales";
import { normalizeName } from "@/lib/nearby/must-visit-core";

export const runtime = "nodejs";

type Suggestion = { placeId: string | null; name: string; city: string; lat?: number; lng?: number };
/** A destination of the catalogue (city, island, lake region) the trip does not include yet. */
type DestinationSuggestion = {
  kind: "destination";
  countryCode: string;
  slug: string;
  name: string;
  country: string;
  seeded: boolean;
  names: Record<string, string>;
  center: { lat: number; lng: number };
  bbox: [number, number, number, number];
};

/**
 * GET /api/places/suggest?q=belem&countries=PT,IT&cities=lisbon&locale=he -> { suggestions }
 * Wishlist autocomplete: catalogue places for demo countries (optionally limited to
 * the chosen cities). Other countries get no suggestions here; the typed name is
 * resolved when the plan is built.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = normalizeName(url.searchParams.get("q") ?? "");
  const locale = url.searchParams.get("locale") ?? "he";
  const lang = isLocale(locale) ? locale : "he";
  const countries = (url.searchParams.get("countries") ?? "").split(",").map((c) => c.trim().toUpperCase()).filter(Boolean);
  const cities = new Set((url.searchParams.get("cities") ?? "").split(",").map((c) => c.trim()).filter(Boolean));
  if (q.length < 2) return NextResponse.json({ suggestions: [] });

  const out: { s: Suggestion; score: number }[] = [];
  const destinations: { d: DestinationSuggestion; score: number }[] = [];
  for (const code of countries) {
    if (!getCountry(code) || (!isDemoCountry(code) && !hasWorldCountry(code))) continue;
    const cityName = new Map([...getSeedCities(code), ...getWorldCities(code)].map((c) => [c.slug, c.names[lang] ?? c.names.en]));
    // "Lake Como" typed on a Milan trip is a destination, not a stop: offer to add it to the trip.
    const seeded = new Set(getSeedCities(code).map((c) => c.slug));
    for (const c of [...getSeedCities(code), ...getWorldCities(code)]) {
      if (cities.has(c.slug)) continue;
      const names = Object.values(c.names).map(normalizeName);
      const score = names.some((n) => n === q) ? 3 : names.some((n) => n.startsWith(q)) ? 2 : names.some((n) => n.includes(q)) ? 1 : 0;
      if (!score || destinations.some((x) => x.d.slug === c.slug)) continue;
      const country = getCountry(code)!;
      destinations.push({
        d: { kind: "destination", countryCode: code, slug: c.slug, name: c.names[lang] ?? c.names.en, country: country.names[lang] ?? country.names.en, seeded: seeded.has(c.slug), names: c.names, center: c.center, bbox: c.bbox },
        score,
      });
    }
    for (const p of [...getSeedPlaces(code), ...getWorldPlaces(code)]) {
      if (cities.size && !cities.has(p.city)) continue;
      const names = [p.nameLocal, ...Object.values(p.names)].map(normalizeName);
      let score = 0;
      for (const n of names) {
        if (n === q) score = Math.max(score, 3);
        else if (n.startsWith(q)) score = Math.max(score, 2);
        else if (n.includes(q)) score = Math.max(score, 1);
      }
      if (score === 0) continue;
      const label = p.names[lang] ?? p.names.en;
      out.push({ s: { placeId: p.id, name: label === p.nameLocal ? label : `${label} / ${p.nameLocal}`, city: cityName.get(p.city) ?? p.city, lat: p.lat, lng: p.lng }, score: score + p.iconicity });
    }
  }
  out.sort((a, b) => b.score - a.score);
  destinations.sort((a, b) => b.score - a.score);
  return NextResponse.json({ suggestions: out.slice(0, 8).map((x) => x.s), destinations: destinations.slice(0, 3).map((x) => x.d) });
}
