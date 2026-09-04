import { NextResponse } from "next/server";
import { z } from "zod";
import { getSeedCities, getSeedPlaces } from "@/lib/data/pois";
import { isDemoCountry } from "@/lib/data/countries";
import { PlannerError, generateItinerary, tripPreferencesSchema } from "@/lib/planner";

export const runtime = "nodejs";

const requestSchema = z.object({ preferences: tripPreferencesSchema });

/**
 * POST /api/plan  { preferences } -> { itinerary, places, diagnostics }
 * Stateless: the guest keeps the result in the browser. Milestone 6 adds weather + holidays here.
 */
export async function POST(req: Request) {
  const parsed = requestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_preferences", issues: parsed.error.issues }, { status: 400 });
  }
  const prefs = parsed.data.preferences;
  const codes = prefs.destinations.map((d) => d.countryCode.toUpperCase());
  const unsupported = codes.filter((c) => !isDemoCountry(c));
  if (unsupported.length) {
    return NextResponse.json({ error: "unsupported_destination", countries: unsupported }, { status: 422 });
  }

  const places = codes.flatMap((c) => getSeedPlaces(c));
  const cities = codes.flatMap((c) => getSeedCities(c));

  try {
    const { itinerary, diagnostics } = generateItinerary({ prefs, places, cities });
    const usedIds = new Set(itinerary.days.flatMap((d) => [...d.activities.map((a) => a.placeId), ...d.rainPlan]));
    const unusedTop = diagnostics.unused.slice(0, 40);
    const keep = places.filter((p) => usedIds.has(p.id) || unusedTop.includes(p.id));
    return NextResponse.json({
      itinerary,
      places: Object.fromEntries(keep.map((p) => [p.id, p])),
      cities,
      diagnostics: { unused: unusedTop, excluded: diagnostics.excluded, budget: diagnostics.budget },
    });
  } catch (err) {
    if (err instanceof PlannerError) {
      return NextResponse.json({ error: "planner_failed", message: err.message, warnings: err.warnings }, { status: 422 });
    }
    throw err;
  }
}
