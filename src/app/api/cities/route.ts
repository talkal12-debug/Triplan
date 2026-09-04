import { NextResponse } from "next/server";
import { getCountry } from "@/lib/data/countries";
import { getPois } from "@/lib/providers/registry";
import { tryProvider } from "@/lib/providers/http";
import type { CitySeed } from "@/lib/data/schemas";

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
  if (q.length < 2 && getPois(country).name !== "seed") return NextResponse.json({ cities: [] });

  const provider = getPois(country);
  const notes: string[] = [];
  const cities = await tryProvider("cities", () => provider.searchCities(country, q, locale), [] as CitySeed[], notes);
  return NextResponse.json({ cities, provider: provider.name, notes });
}
