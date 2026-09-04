import { NextResponse } from "next/server";
import { z } from "zod";
import { getSeedCities, getSeedPlaces } from "@/lib/data/pois";
import { isDemoCountry } from "@/lib/data/countries";
import { itinerarySchema, tripPreferencesSchema } from "@/lib/planner";
import { editOpSchema } from "@/lib/planner/edit-ops";
import {
  alternativesFor,
  moveActivity,
  rebalanceDay,
  rebuildUnlocked,
  removeActivity,
  reorderDay,
  swapActivity,
  toggleLock,
} from "@/lib/planner/edit";

export const runtime = "nodejs";

const requestSchema = z.object({
  preferences: tripPreferencesSchema,
  itinerary: itinerarySchema,
  op: editOpSchema,
});

/**
 * POST /api/plan/edit  { preferences, itinerary, op } -> { itinerary, places, alternatives? }
 * Stateless: the client sends the current plan and gets the edited one back,
 * plus a snapshot of any places the edit introduced.
 */
export async function POST(req: Request) {
  const parsed = requestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request", issues: parsed.error.issues }, { status: 400 });
  }
  const { preferences, itinerary, op } = parsed.data;
  const codes = preferences.destinations.map((d) => d.countryCode.toUpperCase());
  if (codes.some((c) => !isDemoCountry(c))) {
    return NextResponse.json({ error: "unsupported_destination" }, { status: 422 });
  }
  const places = codes.flatMap((c) => getSeedPlaces(c));
  const cities = codes.flatMap((c) => getSeedCities(c));
  const ctx = { prefs: preferences, places, cities };

  if (op.type === "alternatives") {
    return NextResponse.json({ itinerary, alternatives: alternativesFor(itinerary, op.dayIndex, op.activityId, ctx, 3) });
  }

  let next = itinerary;
  switch (op.type) {
    case "swap":
      next = swapActivity(itinerary, op.dayIndex, op.activityId, op.placeId, ctx);
      break;
    case "move":
      next = moveActivity(itinerary, op.fromDay, op.activityId, op.toDay, ctx, op.position);
      break;
    case "reorder":
      next = reorderDay(itinerary, op.dayIndex, op.placeIds, ctx);
      break;
    case "remove":
      next = removeActivity(itinerary, op.dayIndex, op.activityId, ctx);
      break;
    case "rebalance":
      next = rebalanceDay(itinerary, op.dayIndex, op.direction, ctx);
      break;
    case "lock":
      next = toggleLock(itinerary, op.dayIndex, op.activityId);
      break;
    case "rebuild":
      next = rebuildUnlocked(itinerary, op.dayIndex, ctx);
      break;
  }

  const referenced = new Set(next.days.flatMap((d) => [...d.activities.map((a) => a.placeId), ...d.rainPlan]));
  const snapshot = places.filter((p) => referenced.has(p.id));
  return NextResponse.json({ itinerary: next, places: Object.fromEntries(snapshot.map((p) => [p.id, p])) });
}
