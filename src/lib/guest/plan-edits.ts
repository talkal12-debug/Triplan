"use client";

import { z } from "zod";
import { placeSeedSchema } from "@/lib/data/schemas";
import { itinerarySchema } from "@/lib/planner/itinerary";
import type { EditOp } from "@/lib/planner/edit-ops";
import { updateGuestTrip, type GuestPlan, type GuestTrip } from "./trips";

const responseSchema = z.object({
  itinerary: itinerarySchema,
  places: z.record(z.string(), placeSeedSchema).optional(),
  alternatives: z.array(placeSeedSchema).optional(),
});

export class EditError extends Error {}

/** Send one edit to the server, merge the result into the guest trip and persist it. */
export async function applyEdit(trip: GuestTrip, op: EditOp, locale?: string): Promise<{ trip: GuestTrip; alternatives: z.infer<typeof placeSeedSchema>[] }> {
  if (!trip.plan) throw new EditError("no_plan");
  const res = await fetch("/api/plan/edit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ preferences: trip.preferences, itinerary: trip.plan.itinerary, op, locale: locale ?? document.documentElement.lang }),
  });
  const json: unknown = await res.json().catch(() => null);
  if (!res.ok) throw new EditError((json as { error?: string } | null)?.error ?? res.statusText);
  const data = responseSchema.parse(json);

  if (op.type === "alternatives") {
    return { trip, alternatives: data.alternatives ?? [] };
  }
  const plan: GuestPlan = {
    ...trip.plan,
    itinerary: data.itinerary,
    places: { ...trip.plan.places, ...(data.places ?? {}) },
  };
  const updated = updateGuestTrip(trip.id, { plan }) ?? { ...trip, plan };
  return { trip: updated, alternatives: [] };
}
