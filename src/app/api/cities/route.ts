import { NextResponse } from "next/server";
import { getCountry } from "@/lib/data/countries";
import { getPois } from "@/lib/providers/registry";
import { tryProvider } from "@/lib/providers/http";
import type { CitySeed } from "@/lib/data/schemas";
import { getWorldCities } from "@/lib/data/world";

export const runtime = "nodejs";

/**
 * GET /api/cities?country=FR&q=paris&locale=he -> { cities: CitySeed[] }
 * Seed cities for demo countries, Nominatim for everywhere else.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const country = (url.searchParams.get("country") ?? "").toUpperCase();
  const q = (url.searchParams.get("q") ?? "").trim();
  const locale = url.searchParams.get("locale") ?? "he";
  if (!getCountry(country)) return NextResponse.json({ error: "unknown_country" }, { status: 400 });
  const provider = getPois(country);
  const notes: string[] = [];
  const needle = q.toLowerCase();
  const matches = (c: CitySeed) => !needle || Object.values(c.names).some((n) => n.toLowerCase().includes(needle));
  // Prebuilt cities answer first (instantly, with photos); a search that finds none of them goes to Nominatim.
  const world = getWorldCities(country).filter(matches);
  if (q.length < 2) {
    const seeded = provider.name === "seed" ? await tryProvider("cities", () => provider.searchCities(country, q, locale), [] as CitySeed[], notes) : [];
    return NextResponse.json({ cities: [...seeded, ...world.filter((w) => !seeded.some((s) => s.slug === w.slug))], provider: world.length ? "world" : provider.name, notes });
  }
  const live = await tryProvider("cities", () => provider.searchCities(country, q, locale), [] as CitySeed[], notes);
  const cities = [...world, ...live.filter((c) => !world.some((w) => w.slug === c.slug || w.names.en.toLowerCase() === c.names.en.toLowerCase()))];
  return NextResponse.json({ cities, provider: world.length ? "world" : provider.name, notes });
}
