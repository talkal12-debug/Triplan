import { NextResponse } from "next/server";
import { z } from "zod";
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
import { refineTravel } from "@/lib/planner/refine";
import { loadPlanContext } from "@/lib/server/plan-context";
import { getRouting } from "@/lib/providers/registry";

export const runtime = "nodejs";
export const maxDuration = 60;

const requestSchema = z.object({
  preferences: tripPreferencesSchema,
  itinerary: itinerarySchema,
  op: editOpSchema,
});

/**
 * POST /api/plan/edit  { preferences, itinerary, op } -> { itinerary, places, alternatives? }
 * Stateless: the client sends the current plan and gets the edited one back, with real
 * routing re-applied to the days that changed and a snapshot of any new places.
 */
export async function POST(req: Request) {
  const parsed = requestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request", issues: parsed.error.issues }, { status: 400 });
  }
  const { preferences, itinerary, op } = parsed.data;
  const loaded = await loadPlanContext(preferences);
  if (loaded.places.length === 0) return NextResponse.json({ error: "no_places" }, { status: 422 });
  const ctx = { prefs: preferences, places: loaded.places, cities: loaded.cities };

  if (op.type === "alternatives") {
    return NextResponse.json({ itinerary, alternatives: alternativesFor(itinerary, op.dayIndex, op.activityId, ctx, 3) });
  }

  let next = itinerary;
  let touched: number[] = [];
  switch (op.type) {
    case "swap":
      next = swapActivity(itinerary, op.dayIndex, op.activityId, op.placeId, ctx);
      touched = [op.dayIndex];
      break;
    case "move":
      next = moveActivity(itinerary, op.fromDay, op.activityId, op.toDay, ctx, op.position);
      touched = [op.fromDay, op.toDay];
      break;
    case "reorder":
      next = reorderDay(itinerary, op.dayIndex, op.placeIds, ctx);
      touched = [op.dayIndex];
      break;
    case "remove":
      next = removeActivity(itinerary, op.dayIndex, op.activityId, ctx);
      touched = [op.dayIndex];
      break;
    case "rebalance":
      next = rebalanceDay(itinerary, op.dayIndex, op.direction, ctx);
      touched = [op.dayIndex];
      break;
    case "lock":
      next = toggleLock(itinerary, op.dayIndex, op.activityId);
      break;
    case "rebuild":
      next = rebuildUnlocked(itinerary, op.dayIndex, ctx);
      touched = [op.dayIndex];
      break;
  }

  if (touched.length) {
    const routing = getRouting();
    const refined = await refineTravel(next, ctx, (points, mode) => routing.matrix(points, mode), [...new Set(touched)]);
    next = refined.itinerary;
  }

  const referenced = new Set(next.days.flatMap((d) => [...d.activities.map((a) => a.placeId), ...d.rainPlan]));
  const snapshot = loaded.places.filter((p) => referenced.has(p.id));
  return NextResponse.json({ itinerary: next, places: Object.fromEntries(snapshot.map((p) => [p.id, p])) });
}
