"use client";

import { z } from "zod";
import { tripPreferencesSchema, type TripPreferences } from "@/lib/planner/types";
import { citySeedSchema, placeSeedSchema } from "@/lib/data/schemas";
import { itinerarySchema } from "@/lib/planner/itinerary";
import { affiliateLinkSchema } from "@/lib/providers/affiliate";

/**
 * Guest trips live in localStorage until the traveller signs up (milestone 8).
 * A trip holds the preferences and, once built, the plan with a snapshot of the
 * places it references (so it renders offline and survives data updates).
 */
export const GUEST_TRIPS_KEY = "triplan:guest-trips";

export const planExtrasSchema = z.object({
  weather: z.record(
    z.string(),
    z.object({
      date: z.string(),
      precipProbability: z.number(),
      precipMm: z.number().nullable(),
      tempMax: z.number().nullable(),
      tempMin: z.number().nullable(),
      code: z.number().nullable(),
      kind: z.enum(["forecast", "normals"]),
    }),
  ),
  weatherSource: z.string().nullable(),
  holidays: z.array(z.object({ date: z.string(), name: z.string(), localName: z.string(), countryCode: z.string() })),
  rates: z.object({ base: z.string(), date: z.string(), rates: z.record(z.string(), z.number()), source: z.string() }).nullable(),
  links: z.object({
    hotels: z.array(z.object({ stayId: z.string(), links: z.array(affiliateLinkSchema) })),
    tickets: z.record(z.string(), z.array(affiliateLinkSchema)),
    flights: z.array(affiliateLinkSchema),
  }),
  providers: z.record(z.string(), z.string()),
  notes: z.array(z.string()),
});
export type PlanExtras = z.infer<typeof planExtrasSchema>;

export const guestPlanSchema = z.object({
  itinerary: itinerarySchema,
  places: z.record(z.string(), placeSeedSchema),
  cities: z.array(citySeedSchema),
  unused: z.array(z.string()),
  extras: planExtrasSchema.optional(),
});
export type GuestPlan = z.infer<typeof guestPlanSchema>;

export const guestTripSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  preferences: tripPreferencesSchema,
  plan: guestPlanSchema.optional(),
});
export type GuestTrip = z.infer<typeof guestTripSchema>;

function read(): GuestTrip[] {
  try {
    const raw = localStorage.getItem(GUEST_TRIPS_KEY);
    if (!raw) return [];
    const parsed = z.array(guestTripSchema).safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

function write(trips: GuestTrip[]) {
  try {
    localStorage.setItem(GUEST_TRIPS_KEY, JSON.stringify(trips));
  } catch {
    // Private mode / quota: the trip stays in memory for this session only.
  }
}

export function listGuestTrips(): GuestTrip[] {
  return read().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getGuestTrip(id: string): GuestTrip | undefined {
  return read().find((t) => t.id === id);
}

export function createGuestTrip(preferences: TripPreferences): GuestTrip {
  const now = new Date().toISOString();
  const id = `g_${now.slice(0, 10).replaceAll("-", "")}_${Math.random().toString(36).slice(2, 8)}`;
  const trip: GuestTrip = { id, createdAt: now, updatedAt: now, preferences };
  write([trip, ...read()]);
  return trip;
}

export function updateGuestTrip(id: string, patch: Partial<Pick<GuestTrip, "preferences" | "plan">>): GuestTrip | undefined {
  const trips = read();
  const idx = trips.findIndex((t) => t.id === id);
  if (idx < 0) return undefined;
  trips[idx] = { ...trips[idx], ...patch, updatedAt: new Date().toISOString() };
  write(trips);
  return trips[idx];
}

export function deleteGuestTrip(id: string) {
  write(read().filter((t) => t.id !== id));
}
