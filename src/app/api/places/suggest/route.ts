import { NextResponse } from "next/server";
import { getSeedCities, getSeedPlaces } from "@/lib/data/pois";
import { isDemoCountry, getCountry } from "@/lib/data/countries";
import { isLocale } from "@/lib/i18n/locales";
import { normalizeName } from "@/lib/nearby/must-visit-core";

export const runtime = "nodejs";

type Suggestion = { placeId: string | null; name: string; city: string; lat?: number; lng?: number };

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
  for (const code of countries) {
    if (!getCountry(code) || !isDemoCountry(code)) continue;
    const cityName = new Map(getSeedCities(code).map((c) => [c.slug, c.names[lang] ?? c.names.en]));
    for (const p of getSeedPlaces(code)) {
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
  return NextResponse.json({ suggestions: out.slice(0, 8).map((x) => x.s) });
}
