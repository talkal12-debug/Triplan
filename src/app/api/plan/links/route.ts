import { NextResponse } from "next/server";
import { z } from "zod";
import { itinerarySchema, tripPreferencesSchema } from "@/lib/planner";
import { isLocale } from "@/lib/i18n/locales";
import { loadPlanContext, buildPlanLinks } from "@/lib/server/plan-context";

export const runtime = "nodejs";

const requestSchema = z.object({ preferences: tripPreferencesSchema, itinerary: itinerarySchema, locale: z.string().optional() });

/**
 * POST /api/plan/links { preferences, itinerary, locale? } -> { links }
 * Rebuilds only the booking links of an existing plan (no re-planning), so trips
 * saved before a link format changed get the current deep links on next open.
 */
export async function POST(req: Request) {
  const parsed = requestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const { preferences, itinerary } = parsed.data;
  const locale = parsed.data.locale && isLocale(parsed.data.locale) ? parsed.data.locale : "he";
  const ctx = await loadPlanContext(preferences);
  return NextResponse.json({ links: buildPlanLinks(preferences, itinerary, ctx, locale) });
}
