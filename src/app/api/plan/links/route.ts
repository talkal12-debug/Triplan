import { NextResponse } from "next/server";
import { z } from "zod";
import { itinerarySchema, tripPreferencesSchema } from "@/lib/planner";
import { isLocale } from "@/lib/i18n/locales";
import { loadPlanContext, buildPlanLinks, buildHighlights } from "@/lib/server/plan-context";
import { buildNearby } from "@/lib/server/nearby-plan";

export const runtime = "nodejs";
export const maxDuration = 120;

const requestSchema = z.object({ preferences: tripPreferencesSchema, itinerary: itinerarySchema, locale: z.string().optional() });

/**
 * POST /api/plan/links { preferences, itinerary, locale? } -> { links, dining, evenings }
 * Rebuilds only the booking links and the nearby suggestions of an existing plan
 * (no re-planning), so trips saved before a link format changed get the current
 * deep links, restaurants and evenings on next open.
 */
export async function POST(req: Request) {
  const parsed = requestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const { preferences, itinerary } = parsed.data;
  const locale = parsed.data.locale && isLocale(parsed.data.locale) ? parsed.data.locale : "he";
  const ctx = await loadPlanContext(preferences);
  const notes: string[] = [];
  const nearby = await buildNearby(preferences, itinerary, ctx, locale, notes);
  return NextResponse.json({ links: buildPlanLinks(preferences, itinerary, ctx, locale), dining: nearby.dining, evenings: nearby.evenings, ...buildHighlights(preferences, itinerary), notes });
}
