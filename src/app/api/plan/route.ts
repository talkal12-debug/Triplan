import { NextResponse } from "next/server";
import { z } from "zod";
import { PlannerError, generateItinerary, tripPreferencesSchema } from "@/lib/planner";
import { enrichPlan, loadPlanContext, loadSignals } from "@/lib/server/plan-context";
import { isLocale } from "@/lib/i18n/locales";
import { withSummaries } from "@/lib/providers/summaries";

export const runtime = "nodejs";
export const maxDuration = 60;

const requestSchema = z.object({ preferences: tripPreferencesSchema, locale: z.string().optional() });

/**
 * POST /api/plan  { preferences, locale? } -> { itinerary, places, cities, extras, diagnostics }
 * Stateless: the guest keeps the result in the browser.
 * Pipeline: places (seed / OSM) -> weather + holidays -> engine -> real routing -> currency + links.
 */
export async function POST(req: Request) {
  const parsed = requestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_preferences", issues: parsed.error.issues }, { status: 400 });
  }
  const prefs = parsed.data.preferences;
  const locale = parsed.data.locale && isLocale(parsed.data.locale) ? parsed.data.locale : "he";

  const ctx = await loadPlanContext(prefs);
  if (ctx.cities.length === 0) {
    return NextResponse.json({ error: "no_cities", notes: ctx.notes }, { status: 422 });
  }
  if (ctx.places.length === 0) {
    return NextResponse.json({ error: "no_places", notes: ctx.notes }, { status: 422 });
  }

  const signals = await loadSignals(prefs, ctx.cities, ctx.notes);
  const weatherForEngine = Object.fromEntries(Object.entries(signals.weather).map(([d, w]) => [d, { precipProbability: w.precipProbability, tempMax: w.tempMax }]));

  try {
    const { itinerary, diagnostics } = generateItinerary({
      prefs,
      places: ctx.places,
      cities: ctx.cities,
      weather: weatherForEngine,
      holidays: signals.holidays.map((h) => ({ date: h.date, name: h.localName })),
    });
    const enriched = await enrichPlan(prefs, itinerary, ctx, signals, locale);
    const usedIds = new Set(enriched.itinerary.days.flatMap((d) => [...d.activities.map((a) => a.placeId), ...d.rainPlan]));
    const unusedTop = diagnostics.unused.slice(0, 40);
    // One-paragraph descriptions (Wikipedia / Wikidata) for the places that made it into the plan.
    const keep = await withSummaries(
      ctx.places.filter((p) => usedIds.has(p.id) || unusedTop.includes(p.id)),
      locale === "en" ? ["en"] : [locale, "en"],
    );
    return NextResponse.json({
      itinerary: enriched.itinerary,
      places: Object.fromEntries(keep.map((p) => [p.id, p])),
      cities: ctx.cities,
      extras: enriched.extras,
      diagnostics: { unused: unusedTop, excluded: diagnostics.excluded, budget: diagnostics.budget, notes: enriched.extras.notes },
    });
  } catch (err) {
    if (err instanceof PlannerError) {
      return NextResponse.json({ error: "planner_failed", message: err.message, warnings: err.warnings }, { status: 422 });
    }
    throw err;
  }
}
