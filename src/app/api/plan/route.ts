import { NextResponse } from "next/server";
import { z } from "zod";
import { PlannerError, generateItinerary, tripPreferencesSchema } from "@/lib/planner";
import { enrichPlan, loadPlanContext, loadSignals } from "@/lib/server/plan-context";
import { isLocale } from "@/lib/i18n/locales";
import { withSummaries } from "@/lib/providers/summaries";
import { resolveMustVisit } from "@/lib/server/must-visit";

export const runtime = "nodejs";
export const maxDuration = 120;

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
  const locale = parsed.data.locale && isLocale(parsed.data.locale) ? parsed.data.locale : "he";

  const t0 = Date.now();
  const lap = (label: string) => `${label} ${((Date.now() - t0) / 1000).toFixed(1)}s`;
  const ctx = await loadPlanContext(parsed.data.preferences);
  ctx.notes.push(`timing: ${lap("context")}`);
  if (ctx.cities.length === 0) {
    return NextResponse.json({ error: "no_cities", notes: ctx.notes }, { status: 422 });
  }
  if (ctx.places.length === 0) {
    return NextResponse.json({ error: "no_places", notes: ctx.notes }, { status: 422 });
  }
  // Wishlist: catalogue ids stay, free text is matched by name or looked up on OSM; the rest is reported.
  const wish = await resolveMustVisit(parsed.data.preferences, ctx.places, ctx.cities, ctx.notes);
  const prefs = wish.prefs;
  ctx.places.push(...wish.added);

  ctx.notes.push(`timing: ${lap("wishlist")}`);
  const signals = await loadSignals(prefs, ctx.cities, ctx.notes);
  ctx.notes.push(`timing: ${lap("signals")}`);
  const weatherForEngine = Object.fromEntries(Object.entries(signals.weather).map(([d, w]) => [d, { precipProbability: w.precipProbability, tempMax: w.tempMax }]));

  try {
    const { itinerary, diagnostics } = generateItinerary({
      prefs,
      places: ctx.places,
      cities: ctx.cities,
      weather: weatherForEngine,
      holidays: signals.holidays.map((h) => ({ date: h.date, name: h.localName })),
    });
    for (const name of wish.unresolved) itinerary.warnings.push({ code: "must_visit_unresolved", severity: "warning", params: { name } });
    const enriched = await enrichPlan(prefs, itinerary, ctx, signals, locale);
    enriched.extras.notes.push(`timing: ${lap("enriched")}`);
    const usedIds = new Set(enriched.itinerary.days.flatMap((d) => [...d.activities.map((a) => a.placeId), ...d.rainPlan]));
    const unusedTop = diagnostics.unused.slice(0, 40);
    // One-paragraph descriptions (Wikipedia / Wikidata) for the places that made it into the plan,
    // within a time budget; whatever is missing (and the alternatives) is fetched when the trip is opened.
    const visited = await withSummaries(
      ctx.places.filter((p) => usedIds.has(p.id)),
      locale === "en" ? ["en"] : [locale, "en"],
      { deadlineMs: 12_000 },
    );
    const keep = [...visited, ...ctx.places.filter((p) => !usedIds.has(p.id) && unusedTop.includes(p.id))];
    enriched.extras.notes.push(`timing: ${lap("summaries")}`);
    console.log(`[plan] ${enriched.extras.notes.filter((n) => n.startsWith("timing")).join(" | ")}`);
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
